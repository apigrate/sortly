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
    this.rate_limit_max = null;
    this.rate_limit_remaining = null;
    this.rate_limit_reset = null;
  }

  /**
   * Creates an item.
   * 
   * #### Special Note about `tags`
   * The API returns a `tag_names` property (array of strings) on a fetch or search result.
   * However to create tags, you must submit a `tags` array whose contents follow the example:
   * @example 
   * { ...
   *   tags: [ {name: "Tag1"}, {name: "Tag2"} ]
   * }
   * @see https://sortlyapi.docs.apiary.io/#reference/0/items/fetch-item
   *  
   * 
   * @param {object} item @see https://sortlyapi.docs.apiary.io/#reference/0/items/create-an-item
   */
  async createItem(item){
    if(!item) throw new ApiError(`Unable to create item. Data is missing.`);
    if(!item.name) throw new ApiError(`Unable to create item. Missing "name" property.`);
    // if(!item.type) throw new ApiError(`Unable to create item. The "type" property must be either "folder" or "item".`);

    let result = await this.doFetch('POST', `${this.base_url}/items`, null, item);
    if(!result || !result.data) return null;
    return result.data;
  }

  /**
   * Deletes an item
   * @param {number} id 
   * @returns Does not return data.
   */
  async deleteItem(id){
    if(!id) throw new ApiError(`Unable to delete item. Missing "id" property.`);
    await this.doFetch('DELETE', `${this.base_url}/items/${id}`);
  }

  /**
   * Fetches an item by id.
   * 
   * #### Special Note about when including `custom_attributes`
   * The API can return a `custom_attribute_values` property (array of objects) on a fetch or search result.
   * One quirk of the API is that ALL custom attributes are returned for a given item - even those that 
   * are not relevant to items of its type. For example, when fetching an item of type="folder", you will
   * see custom attributes returned for items of type="item". The values for these custom attributes will be null, 
   * and updating them has no effect; but it can be very confusing.
   * 
   * @see https://sortlyapi.docs.apiary.io/#reference/0/items/fetch-item
   * @param {number} id
   * @param {string} include comma-separated type of data to "side-load". Example `custom_attributes,photos`
   * @return {object} the item object directly, or `null` if not found.
   * @example
   * {
   *   "id": 17551135,
   *   "name": "test_item",
   *   "price": null,
   *   "quantity": 1,
   *   "min_quantity": null,
   *   "notes": null,
   *   "parent_id": null,
   *   "sid": "S0ADKT2794",
   *   "label_url": null,
   *   "label_url_type": null,
   *   "label_url_extra": null,
   *   "label_url_extra_type": null,
   *   "tag_names": [],
   *   "type": "item",
   *   "created_at": "2020-10-06T21:12:36.439Z",
   *   "updated_at": "2020-10-06T21:12:36.459Z",
   *   "custom_attribute_values": [
   *     {}, //...custom attribute values (if requested)
   *   ],
   *   "photos": [
   *     {}, //...photos (if requested)
   *   ]
   * }
   */
  async fetchItem(id, include){
    if(!id) throw new ApiError(`Unable to fetch item. Missing "id" property.`);
    let q = null;
    if(include) q={include};
    try{
      let result = await this.doFetch('GET', `${this.base_url}/items/${id}`, q);
      if(!result || !result.data) return null;
      return result.data;
    }catch(ex){
      if(ex instanceof ApiError && ex.status === 404) return null;
      throw ex;
    }
    
  }

  /**
   * Moves an item.
   * @see https://sortlyapi.docs.apiary.io/#reference/0/items/move-an-item
   * Moves a quantity of an item to a different folder. Moving to an non-existant folder has no effect.
   * @param {number} item_id (required)
   * @param {number} quantity (required)
   * @param {number} folder_id destination folder (optional). Moved to root if omitted.
   * @param {boolean} leave_zero_quantity (optional) Determines wether items with zero quantity are kept or not. Default is false. 
   * @returns the item data after move (no sideloading properties are included)
   */
  async moveItem(item_id, quantity, folder_id, leave_zero_quantity){
    if(!item_id) throw new ApiError(`Unable to update item. Data is missing.`);
    if(typeof quantity === 'undefined' || quantity === null) throw new ApiError(`Unable to move item. Missing "quantity" property.`);
    let payload = {
      quantity
    };
    if(folder_id) payload.folder_id = folder_id;
    if(typeof leave_zero_quantity !== 'undefined' && leave_zero_quantity !== null) payload.leave_zero_quantity = leave_zero_quantity;

    let result = await this.doFetch('POST', `${this.base_url}/items/${item_id}/move`, null, payload);
    if(!result || !result.data) return null;
    return result.data;
  }

  /**
   * Searches for items.
   * 
   * @see https://sortlyapi.docs.apiary.io/#reference/0/items/search-items
   * @param {object} search
   * @param {object} search.name name of the item (up to 190 characters)
   * @param {object} search.type `all` (default), `item`, or `folder`
   * @param {array} search.folder_ids array of folders in which to search
   * @param {array} search.sort array of objects with key being field name to sort by, and value being `asc`|`desc`.
   * @param {integer} search.per_page defaults to 100
   * @param {integer} search.page defaults to 1
   * @param {string} search.include
   * @returns an array of metadata and search results
   * @example
   * {
   *   "meta": {
   *     "page": 1,
   *     "next_page_url": null,
   *     "total_pages": 1,
   *     "total_count": 1
   *   },
   *   "data": [
   *     {},//...item data
   *   ]
   * }
   *  
   */
  async searchItems(search){
    return await this.doFetch('POST', `${this.base_url}/items/search`, null, search);
  }

  /**
   * Updates an item.
   * 
   * #### Special Note about `tags`
   * The API returns a `tag_names` property (array of strings) on a fetch or search result.
   * However to update tags, you must submit a `tags` array whose contents follow the example:
   * @example 
   * { ...
   *   tags: [ {name: "Tag1"}, {name: "Tag2"} ]
   * }
   * @see https://sortlyapi.docs.apiary.io/#reference/0/items/fetch-item
   * 
   * @param {object} item to update (must have an 'id' property)
   * @returns Does not return any data.
   */
  async updateItem(item){
    if(!item) throw new ApiError(`Unable to update item. Data is missing.`);
    if(!item.id) throw new ApiError(`Unable to update item. Missing "id" property.`);
    await this.doFetch('PUT', `${this.base_url}/items/${item.id}`, null, item);
    return;
  }

  // 
  // Custom Attributes
  //

  /**
   * Lists custom attributes (a.k.a. custom fields)
   * 
   * @param {number} per_page (default = 10)
   * @param {number} page (default = 1)
   * 
   * @returns search results
   * @example
   * {
   *   "meta": {
   *     "page": 1,
   *     "next_page_url": null,
   *     "total_pages": 1,
   *     "total_count": 1
   *   },
   *   "data": [
   *     {
   *       "id": 9262033,
   *       "name": "my custom attribute",
   *       "type": "text",
   *       "updated_at": "2019-08-22T14:37:01.622Z",
   *       "created_at": "2020-08-22T14:37:04.105Z",
   *       "applies_to": "item"
   *     },//...custom attribute data
   *   ]
   */
  async listCustomAttributes(per_page, page){
    let q = null;
    if(per_page) q={per_page};
    if(page) q={page};
    return await this.doFetch('GET', `${this.base_url}/custom_fields`, q);
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
      
      this.rate_limit_max = response.headers.get("Sortly-Rate-Limit-Max");
      this.rate_limit_remaining = response.headers.get("Sortly-Rate-Limit-Remaining");
      this.rate_limit_reset = response.headers.get("Sortly-Rate-Limit-Reset");

      let result = null;
      if(response.ok){
        debug(`  ...OK HTTP-${response.status}`);
        if(response.status === 204){
          return {};
        }
        result = await response.json();
        verbose(`  response payload: ${JSON.stringify(result)}`);
      } else {
        result = await this.handleNotOk(response)
      }
      return result;

    }catch(err){
      if(err instanceof ApiError) throw err;
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
        verbose(`  authorization error.`);
        throw new ApiAuthError(JSON.stringify(result), response.status);
      }
      //other client errors
      verbose(`  client error. response payload: ${JSON.stringify(result)}`);
      throw new ApiError(result.message, response.status);
    } else if (response.status >=500) {
      //server side errors
      verbose(`  server error. response payload: ${JSON.stringify(result)}`);
      throw new ApiError(result.message, response.status);
    } else { 
      throw err; //Cannot be handled.
    }
    return result;
   
  }
  

}

class ApiError extends Error {
  constructor(msg, status){
    super(msg);
    this.status = status;
  }
};
class ApiAuthError extends ApiError {};

exports.SortlyConnector = SortlyConnector;
exports.ApiError = ApiError;
exports.ApiAuthError = ApiAuthError;

