# sortly
Sortly API Connector


## Usage
Visit: https://pro.sortly.com/public-api to obtain an API access key pair for your account. Then...

Example:
```javascript
const {Sortly} = require('@apigrate/sortly');
let sortly = new Sortly({apiToken: 'api secret key'})
//sortly.listItems etc...
```

## Methods supported

See [Sortly API Docs](https://sortlyapi.docs.apiary.io/#introduction/rate-limiting) for response details.


### Items
#### cloneItem(id, payload)
1. `payload.quantity` {number}  optional
1. `payload.folder_id` {number}  optional, defaults to root folder
1. `payload.include_subtree` {boolean} optional, default false

#### createItem(item)

#### deleteItem(id)

#### getItem(id, opts)
1. `id` {number} id of the item
1. `opts` {object} parameters to pass with the query

Example
```javascript
let resp = await sortly.getItem(478391, {include: "custom_attributes"});

let item = resp.data; // an object
```
#### listItems(opts)
1. `id` {number} id of the item
1. `opts` {object} parameters to pass with the query

Example
```javascript
let resp = await sortly.listItems({page: 1, per_page 50, include: "custom_attributes"});

let items = resp.data; // an array
```
#### listRecentItems(opts)
#### moveItem(id, payload)
1. `payload.quantity` {number} required
1. `payload.folder_id` {number} optional defaults to root folder

#### updateItem(id, item)
Note: nothing returned on success

### Custom Fields
#### listCustomFields(opts)
#### getCustomField(id)

## More Examples
```javascript
const {Sortly}  = require('@apigrate/sortly');
const debug     = require('debug')('gr8:sortly');
const moment    = require('moment');

let sortly = new Sortly({apiToken: process.env.SORTLY_PRIVATE_KEY });

(async function(){
  try{

    let result = null;

    result = await sortly.listCustomFields({page: 1, per_page: 2});

    result = await sortly.listRecentItems({updated_since: moment('2019-07-30T17:49:30.876Z').unix()});

    result = await sortly.getItem(23758);

    let item = await sortly.createItem({
      name: 'Test',
      price: null,
      quanity: null,
      parent_id: null,
      notes: "This is a test folder.",
      type: "folder",
    });
    console.log(`Created item ${item.data.id}`);

    item.data.name = "Testing";
    item.data.notes = "After updating, the item looks like this.";
    result = await sortly.updateItem(item.data.id, item.data);

    result = await sortly.deleteItem(item.data.id);
    console.log(`Deleted item ${item.data.id}`);


    console.log(`Last Result is:\n${JSON.stringify(result,null,2)}` );
    debug(`\nRate limits:\nlimit: ${sortly.rate_limit}\nremaining: ${sortly.rate_limit_remaining}\nreset: ${sortly.rate_limit_reset}`)
  }catch(ex){
    console.error(`Error. ${ex.message}`);
    debug(`\nRate limits:\nlimit: ${sortly.rate_limit}\nremaining: ${sortly.rate_limit_remaining}\nreset: ${sortly.rate_limit_reset}`)
  }
})()
```
