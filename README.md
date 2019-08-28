# sortly
Sortly API Connector

## Methods supported

See [Sortly API Docs](https://sortlyapi.docs.apiary.io/#introduction/rate-limiting) for response details.

### Items
#### cloneItem(id, payload)
1. `payload.quantity` optional
1. `payload.folder_id` optional, defaults to root folder
1. `payload.include_subtree` optional, default false

#### createItem(item)
#### deleteItem(id)
#### getItem(id)
#### listItems(opts)
#### listRecentItems(opts)
#### moveItem(id, payload)
1. `payload.quantity` required
1. `payload.folder_id` optional defaults to root folder

#### updateItem(id, item)
Note: nothing returned on success

### Custom Fields
#### listCustomFields(opts)
#### getCustomField(id)

#### Examples
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
