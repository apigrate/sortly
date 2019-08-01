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

  //Items
  async cloneItem(id, payload){ return this.post(`/items/${id}/move`, payload); } //payload.quantity, payload.folder_id, payload.include_subtree
  async createItem(item){ return this.post(`/items`, item); }
  async deleteItem(id){ return this.delete(`/items/${id}`); }
  async getItem(id){ return this.get(`/items/${id}`); }
  async listItems(opts){ return this.get(`/items`, opts); }
  async listRecentItems(opts){ return this.get(`/items/recent`, opts); }
  async moveItem(id, payload){ return this.post(`/items/${id}/move`, payload); } //payload.quantity required, payload.folder_id optional else root
  async updateItem(id, item){ return this.put(`/items/${id}`, item); }//Note: nothing returned on success

  async get(uri, opts){
    try{
      let qstring = qs.stringify(opts);
      let path = `${uri}${qstring?'?'+qstring:''}`;
      debug(`GET ${path}`);

      let resp = await this.baseRequest(path);
      return this.handleResponse(resp);

    }catch(ex){
      return this.handleResponse(ex);
    }
  }//get method


  async post(uri, entity, opts){
    try{
      let qstring = qs.stringify(opts);
      let path = `${uri}${qstring?'?'+qstring:''}`;
      debug(`POST ${path}`);

      let resp = await this.baseRequest({
        uri: path,
        method: 'POST',
        body: entity
      });
      return this.handleResponse(resp);

    }catch(ex){
      return this.handleResponse(ex);
    }
  }//post method

  async put(uri, entity, opts){
    try{
      let qstring = qs.stringify(opts);
      let path = `${uri}${qstring?'?'+qstring:''}`;
      debug(`PUT ${path}`);

      let resp = await this.baseRequest({
        uri: path,
        method: 'PUT',
        body: entity
      });
      return this.handleResponse(resp);

    }catch(ex){
      return this.handleResponse(ex);
    }
  }//put method

  async delete(uri, opts){
    try{
      let qstring = qs.stringify(opts);
      let path = `${uri}${qstring?'?'+qstring:''}`;
      debug(`DELETE ${path}`);

      let resp = await this.baseRequest({
        uri: path,
        method: 'DELETE'
      });
      return this.handleResponse(resp);

    }catch(ex){
      return this.handleResponse(ex);
    }
  }//post method

  //TODO: put/delete


  //Note, this handles both the response and error payloads from request-promise-native.
  handleResponse(resp){
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
          throw new Error(`Request Error. ${resp.message}`);

          case 401:
          debug(resp.message)
          throw new Error(`Authorization Error. ${resp.message}`);

          case 404:
          debug(resp.message)
          return null; //Don't throw an error, return null.

          case 429:
          throw new RateLimitExceeded(`Sortly rate limit exceeded. Try again in ${this.rate_limit_reset} seconds.`);

          default:
          throw new Error(`Unhandled Error (HTTP-${resp.statusCode}). ${resp.message}`);

        }

      } else if( resp.statusCode >=500){
        debug(`Server error. HTTP-${resp.statusCode}`);
        //response body may not be parseable. Return error with raw body.
        throw new Error(`Sortly Server Error (HTTP-${resp.statusCode}). Details: ${resp.body}`);
      } else {
        debug(`HTTP-${resp.statusCode}`);
        //Some other potentially valid response. Return the payload.
        return responseBody;
      }
    }


  }


}//Sortly

class RateLimitExceeded extends Error {};
exports.Sortly = Sortly;
exports.RateLimitExceeded = RateLimitExceeded;
