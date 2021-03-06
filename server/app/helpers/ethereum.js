const Web3 = require('../helpers/web3.js');
const web3 = Web3.web3;
const BigNumber = Web3.BigNumber;
const axios = require('axios');

const gasAPI = "https://ethgasstation.info/json/ethgasAPI.json";
var e; //await function

Ethereum = {
  isSyncing: async function () {
    let obj = {};
    return await web3.eth.isSyncing()
      .then(function (result) {
        obj.nodeSynced = result == false ? true : result;
        return obj;
      })
      .catch((err) => {
        // console.log('isSyncing error:', err.message);
        obj.error = err.message;
        return obj;
      })
  },
  /**
   * Get ethereum and wei balances for a valid address
   * @param {string} address 
   * @return {Promise} Promise obj with data or error
   */
  getBalance: async function (address) {
    let obj = {};
    let e = await web3.eth.getBalance(address)
      .then(function (result) {
        obj.weiBalance = result;
        obj.etherBalance = web3.utils.fromWei(result, 'ether');
        // console.log('obj', obj);
        return obj;
      }).catch(function (err) {
        console.log(err.message);
        return obj.error = err.message;
      });
    return e;
  },
  /**
   * Get latest block
   * @return {(Promise|Object)}
   */
  getBlockNumber: async function () {
    let obj = {};
    let e = await web3.eth.getBlockNumber()
      .then(function (result) {
        obj.blockNumber = result;
        return obj;
      }).catch(function (err) {
        console.log(err.message);
        return obj.error = err.message;
      });
    return e;
  },
  /**
   * Get transaction details by hash
   * @param {string} transactionHash hash for a transaction
   * @return {(Promise|Object)}
   */
  getTransaction: async function (transactionHash) {
    let obj = {};
    return await web3.eth.getTransaction(transactionHash)
      .then(function (result) {
        obj.accounts = result;
        return obj;
      }).catch(function (err) {
        // console.log('getTransaction', err.message);
        obj.error = err.message;
        return obj;
      });
  },
  /**
   * Similar to getBlock 
   * NOTE: seems to only work without error locally with ganache node
   * ERROR in Ropsten Testnet: "Returned error: invalid argument 1: json: cannot unmarshal non-string into Go value of type hexutil.Uint"
   * @param {number} hashStringOrNumber is the block hash or block number
   * @return {(Promise|Object)}
   */
  getTransactionFromBlock: async function (hashStringOrNumber) {
    let obj = {};
    return await web3.eth.getTransactionFromBlock(hashStringOrNumber)
      .then(function (result) {
        obj.accounts = result;
        return obj;
      }).catch(function (err) {
        // console.log('ttt', err.message);
        obj.error = err.message;
        return obj;
      });
  },
  /**
   * get the block data for provide block number
   * @param {number} blockNumber is the block number of block hash
   * @param {boolean} showTxObject is a truth value to show transaction hash only or the entire object in the output
   * @param {string} useString overwrites the blocknumber to use the string from the api: http://web3js.readthedocs.io/en/1.0/web3-eth.html#getblock
   * @return {(Promise|Object)} either error or block data
   */
  getBlock: async function (blockNumber, showTxObject, useString) {
    let obj = {};
    if (isNaN(blockNumber)) {
      obj.error = `'${blockNumber}' is an invalid block number`;
      return obj;
    }
    blockNumber = useString != null ? useString : blockNumber;
    showTxObject = showTxObject != null ? showTxObject : false;
    return await web3.eth.getBlock(blockNumber, showTxObject)
      .then(function (result) {
        obj = result;
        return obj;
      })
      .catch((err) => {
        // console.log('getBlock error:', err.message);
        obj.error = err.message;
        return obj;
      })
  },
  /**
   * Generates new public address and private key and stores private key inside node
   * @return {Promise} object with address and key
   */
  createAccount: async function () {
    return new Promise(((resolve, reject) => {
      e = web3.eth.accounts.create();
      // console.log('new', e);
      resolve(e);
    }))
  },
  /**
   * Get all accounts generated and saved to node
   * @return {(Promise|Object.<Array>)} obj with array of all accounts
   */
  getAccounts: async function () {
    let obj = {};
    let e = await web3.eth.getAccounts()
      .then(function (result) {
        obj.accounts = result;
        return obj;
      }).catch(function (err) {
        // console.log('ttt', err.message);
        obj.error = err.message;
        return obj
      });
    return e;
  },
  /**
   * Get information object on the transaction you plan to send before sending
   * This helps check for gas and gas price and verify your transaction is correct
   * @param {Object} txObject is the req.body from the controller that has been validated
   * @return {Object} is the completed object that contains data about the transaction and further validation
   */
  sendTransactionInfo: async function (txObject) {
    let obj = {};
    e = await processTxInfoData(txObject)
      .then(function (result) {
        return result;
      }).catch(function (err) {
        obj.error = err.message
        return obj;
      });
    return e;
  },
  /**
   * Send a transaction with node accounts to avoid using private keys
   * The transaction object passed comes from the completed object 
   * @param {Object} txObject is the req.body from the controller that has been validated
   * @return {(Promise|Events|Object)} events come from web3 API; returned object is the completed transaction receipt
   */
  sendTransaction: async function (txObject) {
    let obj = {};
    e = await processTxInfoData(txObject)
      .then(function (result) {
        let e2 = web3.eth.sendTransaction(result.paramsUpdated)
        // .on('receipt', function(receipt){
        //   console.log('tx receipt',receipt);
        // })
        return e2;
      }).catch(function (err) {
        obj.error = err.message
        return obj;
      });
    return e;
  },
}

module.exports = Ethereum;

/**
 * processes transaction data for information and to use for sending a transaction
 * @param {Object} txObject is the req.body from the controller that has been validated
 * @return {(Promise|Object)}
 */
async function processTxInfoData(txObject) {
  let obj = {};
  return new Promise(async (resolve, reject) => {
    // check value is a number
    if (isNaN(txObject.value)) {
      reject(new Error(`value is not a valid number`))
    }
    // convert ether to ether amount to wei
    let wei = web3.utils.toWei(txObject.value, 'ether');
    // get gas prices 
    const getCurrentGasPrices = async () => {
      let response = await axios.get(gasAPI)
      let prices = {
        low: response.data.safeLow / 10,
        medium: response.data.average / 10,
        high: response.data.fast / 10
      }
      return prices;
    }
    let gasPrices = await getCurrentGasPrices()
    // calculate gas
    let gasPriceDefault = gasPrices.low * 1000000000;
    let gasPriceTypeCustom = txObject.gasPrice != null ? txObject.gasPrice.toLowerCase() : null;
    // validate gasPrice
    let gasPrice;
    if (gasPriceTypeCustom == null) {
      gasPrice = gasPriceDefault
    } else {
      if (gasPrices[gasPriceTypeCustom] === undefined) {
        gasPrice = gasPriceDefault
        reject(new Error('gasPrice is invalid'))
      } else {
        gasPrice = gasPrices[gasPriceTypeCustom] * 1000000000;
      }
    }
    // let gasPrice = gasPriceTypeCustom != null ? gasPrices[gasPriceTypeCustom] * 1000000000 : gasPriceDefault;

    // set tx object to calculate transaction gas
    let params = {
      "from": txObject.from,
      "to": txObject.to,
      "gasPrice": gasPrice,
      // "nonce": nonce,
      "value": wei
    };
    // get transaction gas
    let estimatedGas;
    await web3.eth.estimateGas(params).then((price) => {
      estimatedGas = price;
    })
      .catch((error, receipt) => {
        estimatedGas = null;
        reject(new Error('failed to estimate gas'))
      });
    // validate gas value from controller
    let gas = txObject.gas != null ? txObject.gas : estimatedGas;
    if (gas < estimatedGas) {
      reject(new Error(`gas input is less than estimated gas for this transaction: ${estimatedGas}`));
    }
    else if (isNaN(txObject.gas)) {
      reject(new Error(`gas input is not a number`));
    }
    // set final tx object for sending transaction
    let paramsUpdated = {
      "from": txObject.from,
      "to": txObject.to,
      "gas": gas,
      "gasPrice": gasPrice,
      // "nonce": nonce,
      "value": wei
    };
    obj.amountToSendEther = txObject.value;
    obj.amountToSendWei = wei;
    obj.gasPrices = gasPrices;
    obj.gasPriceTypeDefault = "low";
    obj.gasPriceDefault = gasPriceDefault;
    obj.gasPriceTypeCustom = gasPriceTypeCustom;
    obj.gasPrice = gasPrice;
    obj.estimatedGas = estimatedGas;
    obj.gas = gas;
    obj.params = params;
    obj.paramsUpdated = paramsUpdated;
    resolve(obj);
  })
}