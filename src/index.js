import 'regenerator-runtime/runtime'

import { initContract, login, logout } from './utils'

import getConfig from './config'
const { networkId } = getConfig(process.env.NODE_ENV || 'development')

import { utils } from 'near-api-js'

import Big from 'big.js';

const submitButton = document.querySelector('form button')

const BOATLOAD_OF_GAS = '35000000000000';

document.querySelector('form').onsubmit = async (event) => {
    event.preventDefault()

    const form = event.target;

    // // get elements from the form using their id attribute
    // const { fieldset, greeting } = event.target.elements

    // // disable the form while the value gets updated on-chain
    // fieldset.disabled = true
    form.disabled = true;

    try {
        await window.contract.buy({
            berries: form.querySelector('#berriesToBuy').value
        }, BOATLOAD_OF_GAS, utils.format.parseNearAmount(form.querySelector('#maxNearPrice').value));
    } catch (e) {
        alert(
            'Something went wrong! ' +
            'Maybe you need to sign out and back in? ' +
            'Check your browser console for more info.'
        )
        throw e
    } finally {
        // re-enable the form, whether the call succeeded or failed
        form.disabled = false
    }

    // disable the save button, since it now matches the persisted value
    submitButton.disabled = true

    // update the greeting in the UI
    await fetchGreeting()

    // show notification
    document.querySelector('[data-behavior=notification]').style.display = 'block'

    // remove notification again after css animation completes
    // this allows it to be shown again next time the form is submitted
    setTimeout(() => {
        document.querySelector('[data-behavior=notification]').style.display = 'none'
    }, 11000)
}

document.querySelector('#sign-in-button').onclick = login
document.querySelector('#sign-out-button').onclick = logout

document.querySelector('#berriesToBuy').onchange = async (event) => {
    let nearPrice = await window.contract.getBuyPrice({ berries: event.target.value });
    // TODO: Convert from nomination
    nearPrice = Big(nearPrice).mul('1.01').toFixed(0);

    document.querySelector('#maxNearPrice').value = utils.format.formatNearAmount(nearPrice, 5); 
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

// update global currentGreeting variable; update DOM with it
async function fetchGreeting() {
    // currentGreeting = await contract.getGreeting({ accountId: window.accountId })
    // document.querySelectorAll('[data-behavior=greeting]').forEach(el => {
    //     // set divs, spans, etc
    //     el.innerText = currentGreeting

    //     // set input elements
    //     el.value = currentGreeting
    // })
}

// `nearInitPromise` gets called on page load
window.nearInitPromise = initContract()
    .then(() => {
        if (window.walletConnection.isSignedIn()) signedInFlow()
        else signedOutFlow()
    })
    .catch(console.error)
