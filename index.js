/*
  Copyright 2019 Apigrate LLC

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
const debug        = require('debug')('gr8:sortly');
const request      = require('request-promise-native');
const qs           = require('qs');

/**
 * API connector for Sortly
 *
 * See API documentation at: https://sortlyapi.docs.apiary.io/
 * @version 1.1.5
 *
 */
class Sortly{
  /**
   * @param {object} options object hash storing connector options
   * @example {
   *  apiToken: <privileged access token>
   * }
   */
  constructor(options){
    this.options = options;
    this.baseRequest = request.defaults({
      baseUrl: 'https://api.sortly.co/api/v1',
      headers:{
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + options.apiToken
      },
      json: true,
      //time: options.measureTiming || false,
      resolveWithFullResponse : true
    });

    this.rate_limit = 0;
    this.rate_limit_remaining = 0;
    this.rate_limit_reset = 0;//time in s when reate limit window resets
    this.request_id = 0;
  }

  //Custom Fields
  async listCustomFields(opts){ return this.get(`/custom_fields`, opts); }
  async getCustomField(id){ return this.get(`/custom_fields/${id}`); }

  //Items
  async cloneItem(id, payload){ return this.post(`/items/${id}/move`, payload); } //payload.quantity, payload.folder_id, payload.include_subtree
  async createItem(item){ return this.post(`/items`, item); }
  async deleteItem(id){ return this.delete(`/items/${id}`); }
  async getItem(id, opts){ return this.get(`/items/${id}`, opts); }
  async listItems(opts){ return this.get(`/items`, opts); }
  async listRecentItems(opts){ return this.get(`/items/recent`, opts); }
  async moveItem(id, payload){ return this.post(`/items/${id}/move`, payload); } //payload.quantity required, payload.folder_id optional else root
  async updateItem(id, item){ return this.put(`/items/${id}`, item); }//Note: nothing returned on success

  async get(uri, opts){
    let req = {
      method: 'GET'
    };
    try{
      let qstring = qs.stringify(opts);
      req.uri = `${uri}${qstring?'?'+qstring:''}`;
      debug(`GET ${req.uri}`);

      let resp = await this.baseRequest(req);
      return this.handleResponse(resp, null, req);

    }catch(ex){
      return this.handleResponse(ex, null, req);
    }
  }//get method


  async post(uri, entity, opts){
    let req = {
      method: 'POST'
    };
    try{
      let qstring = qs.stringify(opts);
      req.uri = `${uri}${qstring?'?'+qstring:''}`;
      req.body = entity;
      debug(`POST ${req.uri}\n\tpayload: ${JSON.stringify(entity)}`);
      
      let resp = await this.baseRequest(req);
      return this.handleResponse(resp, entity, req);

    }catch(ex){
      return this.handleResponse(ex, entity, req);
    }
  }//post method

  async put(uri, entity, opts){
    let req = {
      method: 'PUT'
    };
    try{
      let qstring = qs.stringify(opts);
      req.uri = `${uri}${qstring?'?'+qstring:''}`;
      req.body = entity;
      debug(`PUT ${req.uri}\n\tpayload: ${JSON.stringify(entity)}`);

      let resp = await this.baseRequest(req);
      return this.handleResponse(resp, entity, req);

    }catch(ex){
      return this.handleResponse(ex, entity, req);
    }
  }//put method

  async delete(uri, opts){
    let req = {
      method: 'DELETE'
    };
    try{
      let qstring = qs.stringify(opts);
      req.uri = `${uri}${qstring?'?'+qstring:''}`;
      debug(`DELETE ${req.uri}`);

      let resp = await this.baseRequest(req);
      return this.handleResponse(resp, null, req);

    }catch(ex){
      return this.handleResponse(ex, null, req);
    }
  }//post method


  //Note, this handles both the response and error payloads from request-promise-native.
  handleResponse(resp, reqbody, req){
    // debug(`HTTP-${resp.statusCode}`);
    // debug(`Response Headers:\n${JSON.stringify(resp.headers,null,2)}`);
    debug(`Response:\n${JSON.stringify(resp)}`);

    if(resp.statusCode >=200 && resp.statusCode <300){
      this.rate_limit            = resp.headers['sortly-rate-limit-max'];
      this.rate_limit_remaining  = resp.headers['sortly-rate-limit-remaining'];
      this.rate_limit_reset      = resp.headers['sortly-rate-limit-reset'];
      this.request_id            = resp.headers['x-request-id'];
      switch(resp.statusCode){
        case 204:
        return;//nothing returned

        default:
        return resp.body;
      }

    } else {
      //Client-side errors.
      this.rate_limit            = resp.response.headers['sortly-rate-limit-max'] || this.rate_limit;
      this.rate_limit_remaining  = resp.response.headers['sortly-rate-limit-remaining'] || this.rate_limit_remaining;
      this.rate_limit_reset      = resp.response.headers['sortly-rate-limit-reset'] || this.rate_limit_reset;
      this.request_id            = resp.response.headers['x-request-id'];

      if (resp.statusCode >= 400 && resp.statusCode < 500) {
        switch(resp.statusCode){
          case 400:
            throw new Error(`Request Error on ${req.method} ${req.uri} (HTTP-${resp.statusCode}). ${resp.message}\n\tsent:${reqbody ? JSON.stringify(reqbody) : ""}\n\treceived:${JSON.stringify(resp.response.body)}`);


          case 401:
            debug(resp.message)
            throw new Error(`Authorization Error on ${req.method} ${req.uri} (HTTP-${resp.statusCode}). ${resp.message}`);

          case 404:
            debug(resp.message)
            if (req.method === "GET") {
              return null; //Don't throw an error, return null.
            }
            throw new Error(`Invalid URI on ${req.method} ${req.uri} (HTTP-${resp.statusCode}).`);

          case 429:
            throw new RateLimitExceeded(`Sortly rate limit exceeded on ${req.method} ${req.uri}. Try again in ${this.rate_limit_reset} seconds.`);

          default:
            throw new Error(`Unhandled Error on ${req.method} ${req.uri} (HTTP-${resp.statusCode}). ${resp.message}`);

        }

      } else if( resp.statusCode >=500){
        debug(`Server error. HTTP-${resp.statusCode}`);
        //response body may not be parseable. Return error with raw body.
        throw new Error(`Sortly Server Error on ${req.method} ${req.uri} (HTTP-${resp.statusCode}).\n\tsent:${reqbody ? JSON.stringify(reqbody) : ""}\n\treceived:${JSON.stringify(resp.response.body)}`);
      } else {
        debug(`Error on ${req.method} ${req.uri}. HTTP-${resp.statusCode}`);
        //Some other potentially valid response. Return the payload.
        return responseBody;
      }
    }


  }


}//Sortly

class RateLimitExceeded extends Error {};
exports.Sortly = Sortly;
exports.RateLimitExceeded = RateLimitExceeded;
