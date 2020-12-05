import 'regenerator-runtime/runtime'

import { initContract, login, logout } from './utils'

import getConfig from './config'
const { networkId } = getConfig(process.env.NODE_ENV || 'development')

import { utils } from 'near-api-js'

import Big from 'big.js';

const submitButton = document.querySelector('form button')

const BOATLOAD_OF_GAS = '35000000000000';
const BERRIES_CONTRACT = 'berryclub.ek.near';


const handleSubmit = handler => async (event) => {
    event.preventDefault()

    const form = event.target;
    form.querySelector('fieldset').disabled = true;

    try {
        await handler(form);
    } catch (e) {
        alert(
            'Something went wrong! ' +
            'Maybe you need to sign out and back in? ' +
            'Check your browser console for more info.'
        )
        throw e
    } finally {
        form.querySelector('fieldset').disabled = false;
    }

    await fetchGreeting()
}

document.querySelector('#buyForm').onsubmit = handleSubmit(async form => {
    await window.contract.buy({
        berries: parseBerriesAmount(form.querySelector('#berriesToBuy').value)
    }, BOATLOAD_OF_GAS, utils.format.parseNearAmount(form.querySelector('#maxNearPrice').value));
});

document.querySelector('#sellForm').onsubmit = handleSubmit(async form => {
    const account = await window.walletConnection.account();
    await account.functionCall(BERRIES_CONTRACT, 'transfer_with_vault', {
        receiver_id: window.contract.contractId,
        amount: formatBerryAmount(form.querySelector('#maxBerriesPrice').value),
        payload: `sell:${utils.format.parseNearAmount(form.querySelector('#nearToBuy').value)}`
    }, BOATLOAD_OF_GAS, '1');
});


document.querySelector('#sign-in-button').onclick = login
document.querySelector('#sign-out-button').onclick = logout

const BERRIES_NOMINATION = Big(10).pow(18)

function parseBerriesAmount(berries) {
    return Big(berries).mul(BERRIES_NOMINATION).toFixed(0);
}

function formatBerryAmount(berries, fracDigits = 5) {
    return Big(berries).div(BERRIES_NOMINATION).toFixed(fracDigits);
}

document.querySelector('#berriesToBuy').onchange = async (event) => {
    let nearPrice = await window.contract.getBuyPrice({ berries: parseBerriesAmount(event.target.value) });
    nearPrice = Big(nearPrice).mul('1.01').toFixed(0);

    document.querySelector('#maxNearPrice').value = utils.format.formatNearAmount(nearPrice, 5); 
}

document.querySelector('#nearToBuy').onchange = async (event) => {
    let berryPrice = await window.contract.getSellPrice({ nearAmount: utils.format.parseNearAmount(event.target.value) });
    berryPrice = Big(berryPrice).mul('1.01').toFixed(0);

    document.querySelector('#maxBerriesPrice').value = formatBerryAmount(berryPrice, 5); 
}

// Display the signed-out-flow container
function signedOutFlow() {
    document.querySelector('#signed-out-flow').style.display = 'block'
}

// Displaying the signed in flow container and fill in account-specific data
function signedInFlow() {
    document.querySelector('#signed-in-flow').style.display = 'block'

    document.querySelectorAll('.accountId').forEach(el => {
        el.innerText = window.accountId
    })

    fetchGreeting()
}

async function fetchGreeting() {
    const account = await window.walletConnection.account();
    const { total: accountBalance } = await account.getAccountBalance();
    document.querySelector('#nearBalance').value = utils.format.formatNearAmount(berriesBalance, 5);
    const berriesBalance = await account.viewFunction('get_balance');
    document.querySelector('#berriesBalance').value = formatBerryAmount(berriesBalance);
}

// `nearInitPromise` gets called on page load
window.nearInitPromise = initContract()
    .then(() => {
        if (window.walletConnection.isSignedIn()) signedInFlow()
        else signedOutFlow()
    })
    .catch(console.error)
