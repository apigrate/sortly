const fetch = require('node-fetch');
const qs = require('query-string');
const debug = require('debug')('gr8:sortly');
const verbose = require('debug')('gr8:sortly:verbose');


/**
 * A NodeJS connector for the Sortly API.
 */
class SortlyConnector{
  /**
   * @constructor
   * @param {object} config 
   * @param {string} config.base_url 
   * @param {string} config.api_token 
   */
  constructor(config){
    this.base_url = config.base_url || `https://api.sortly.co/api/v1`
    this.api_token = config.api_token;
  }
 

  // /** Gets a quote for a symbol */
  // async getQuote(symbol){
  //   return this.doFetch('GET', `${this.base_url}/marketdata/${symbol}/quotes`);
  // }
 
  /**
   * Searches for sortly items.
   * @param {object} search
   * @param {object} search.name name of the item (up to 190 characters)
   * @param {object} search.type `all` (default), `item`, or `folder`
   * @param {array} search.folder_ids array of folders in which to search
   * @param {array} search.sort array of objects with key being field name to sort by, and value being `asc`|`desc`.
   * @param {integer} search.per_page defaults to 100
   * @param {integer} search.page defaults to 1
   * @param {string} search.include
   */
  async searchItems(search){
    return this.doFetch('POST', `${this.base_url}/items/search`, null, search);
  }



  /**
   * Internal method to make an API call using node-fetch.
   * 
   * @param {string} method GET|POST|PUT|DELETE
   * @param {string} url api endpoint url (without query parameters)
   * @param {object} query hash of query string parameters to be added to the url
   * @param {object} payload for POST, PUT methods, the data payload to be sent
   * @param {object} options hash of additional options
   * @param {object} options.headers hash of headers. Specifying the headers option completely
   * replaces the default headers.
   * 
   * Note, if the API you are working with returns an HTTP-200 status but the payload may contain errors,
   * implement the handleNotOK method.
   */
  async doFetch(method, url, query, payload, options){

    if(!options){
      options = {};
    }
    if(!options.retries){
      options.retries = 0;
    }

    let fetchOpts = {
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Apigrate Sortly Connector/2.x",
        "Authorization": `Bearer ${this.api_token}`
      },
    };


    //Assign additional headers as provided directly.
    if(options && options.headers){
      Object.assign(fetchOpts.headers, options.headers);  
    }
    
    let qstring = '';
    if(query){
      qstring = qs.stringify(query);
      qstring = '?'+qstring;
    }
    let full_url = `${url}${qstring}`;
    
    if(payload){
      fetchOpts.body = JSON.stringify(payload);
      verbose(`  JSON payload: ${JSON.stringify(payload)}`);
    }

    try{
      debug(`${method} ${full_url}`);
      
      let response = await fetch(full_url, fetchOpts);

      let result = null;
      if(response.ok){
        debug(`  ...OK HTTP-${response.status}`);
        result = await response.json();
        verbose(`  response payload: ${JSON.stringify(result)}`);
      } else {
        result = await this.handleNotOk(response)
      }
      return result;

    }catch(err){
      //Unhandled errors are noted and re-thrown.
      console.error(err);
      throw err;
    }
  }

  /**
   * Handles API responses that are not in the normal HTTP OK code range (e.g. 200) in a consistent manner.
   * @param {object} response the fetch response (without any of the data methods invoked) 
   * @param {string} url the full url used for the API call
   * @param {object} fetchOpts the options used by node-fetch
   */
  async handleNotOk(response, url, fetchOpts){
    debug(`  ...Error. HTTP-${response.status}`);
    
    //Note: Some APIs return HTML or text depending on status code...
    let result = await response.json();
    if (response.status >=300 & response.status < 400){
      //redirection
    } else if (response.status >=400 & response.status < 500){
      if(response.status === 401 || response.status === 403){
        debug(`  authorization error.`);
        throw new ApiAuthError(JSON.stringify(result));
      }
      //client errors
      verbose(`  client error. response payload: ${JSON.stringify(result)}`);
    } else if (response.status >=500) {
      //server side errors
      verbose(`  server error. response payload: ${JSON.stringify(result)}`);
    } else { 
      throw err; //Cannot be handled.
    }
    return result;
   
  }
  

}

class ApiError extends Error {};
class ApiAuthError extends Error {};

exports.SortlyConnector = SortlyConnector;
exports.ApiError = ApiError;
exports.ApiAuthError = ApiAuthError;

