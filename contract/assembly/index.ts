/*
 * This is an example of an AssemblyScript smart contract with two simple,
 * symmetric functions:
 *
 * 1. setGreeting: accepts a greeting, such as "howdy", and records it for the
 *    user (account_id) who sent the request
 * 2. getGreeting: accepts an account_id and returns the greeting saved for it,
 *    defaulting to "Hello"
 *
 * Learn more about writing NEAR smart contracts with AssemblyScript:
 * https://docs.near.org/docs/roles/developer/contracts/assemblyscript
 *
 */

import { context, ContractPromise, ContractPromiseBatch, logging, storage, u128, util, PersistentDeque } from 'near-sdk-as'

const NEAR_NOMINATION = u128.from('1000000000000000000000000');
const MIN_FRACTION = u128.from('1000000000000');
const PRICE_TICK = NEAR_NOMINATION / MIN_FRACTION / u128.from('10000');

const CALLBACK_GAS: u64 = 30_000_000_000_000;

export function berriesContract(): string {
    return storage.get<string>('berriesContract', 'berryclub.ek.near')!;
}

function assertOwner(): void {
    assert(context.predecessor == context.contractName, 'must be called by owner');
}

export function start(berriesContract: string): void {
    assertOwner();
    storage.set('started', true);
    storage.set('berriesContract', berriesContract);
}

export function stop(): void {
    assertOwner();

    storage.delete('started');
}

function assertPoolStarted(): void {
    assert(storage.contains('started'), 'pool not started yet');
}

@nearBindgen
class TransferRawArgs {
    receiver_id: string;
    amount: u128;
}

@nearBindgen
class OrderInfo {
    sender: string;
    nearAmount: u128;
    berries: u128;
}

export function placeBuyOrder(berries: u128): void {
    assertPoolStarted();

    assert(berries >= MIN_FRACTION, 'cannot exchange less than ' + MIN_FRACTION.toString() + ' berries');

    // TODO: Charge for storage deposit!
    const nearAmount = context.attachedDeposit;
    // TODO: Make sure doesn't overflow?
    const price = priceWithTicks(berries, nearAmount);

    assert(price > u128.Zero, 'too small amount of NEAR attached');

    const priceBucket = price / PRICE_TICK;
    assert(priceBucket > u128.Zero, 'price is too small');

    const buyOrders = new PersistentDeque<OrderInfo>('buy:' + priceBucket.toString());
    buyOrders.pushBack({
        sender: context.predecessor,
        nearAmount,
        berries
    });

    if (storage.get<u128>('buy:maxPrice', u128.Min) < priceBucket) {
        storage.set('buy:maxPrice', priceBucket);
    }
}

function priceWithTicks(berries: u128, nearAmount: u128): u128 {
    return nearAmount / (berries / MIN_FRACTION) * PRICE_TICK / MIN_FRACTION;
}

function placeSellOrder(sender: string, berries: u128, nearAmount: u128): void {
    assertPoolStarted();

    assert(nearAmount >= MIN_FRACTION, 'cannot exchange less than ' + MIN_FRACTION.toString() + ' yoctoNEAR');

    // TODO: Charge for storage deposit!
    const price = priceWithTicks(berries, nearAmount);
    // TODO: Make sure to round to proper direction
    logging.log('nearAmount ' + nearAmount.toString());
    logging.log('berries ' + berries.toString());
    logging.log('price ' + price.toString());

    assert(price > u128.Zero, 'too small amount of berries attached');

    const priceBucket = price / PRICE_TICK;
    assert(priceBucket > u128.Zero, 'price is too small');

    const sellOrders = new PersistentDeque<OrderInfo>('sell:' + priceBucket.toString());
    sellOrders.pushBack({
        sender,
        nearAmount,
        berries
    });

    if (storage.get<u128>('sell:minPrice', u128.Max) > priceBucket) {
        storage.set('sell:minPrice', priceBucket);
    }
}

export function executeTrades(): ContractPromise {
    const sellMinPrice = storage.getSome<u128>('sell:minPrice');
    const buyMaxPrice = storage.getSome<u128>('buy:maxPrice');
    if (sellMinPrice < buyMaxPrice) {
        logging.log('No matching orders');
        return;
    }

    const sellOrders = new PersistentDeque<OrderInfo>('sell:' + sellMinPrice.toString());
    const buyOrders = new PersistentDeque<OrderInfo>('sell:' + buyMaxPrice.toString());
    const sellOrder = sellOrders.popFront();
    const buyOrder = buyOrders.popFront();
    // TODO
    // if (sellOrder.berries >= buyOrder.berries) {
    //     sellOrder.berries -= buyOrder.berries;
    //     sellOrder.nearAmount -= buyOrder.nearAmount / priceWithTicks(sellOrder.berries, sellOrder.nearAmount) * PRICE_TICK;
    //     if (sellOrder.berries > buyOrder.berries) {
    //         sellOrders.pushFront(sellOrder);
    //     }
    //     return ContractPromise.create<TransferRawArgs>(berriesContract(), 'transfer_raw', { receiver_id: buyOrder.sender, amount: buyOrder.berries } )
    // }
}

@nearBindgen
class WithdrawFromVaultArgs {
    // TODO: Sort out u32/u64/u53 situation
    vault_id: u32;
    receiver_id: string;
    amount: u128;
}

function withdrawFromVault(vault_id: u32, receiver_id: string, amount: u128): ContractPromise {
    return ContractPromise.create<WithdrawFromVaultArgs>(berriesContract(),
        'withdraw_from_vault', { receiver_id, amount, vault_id }, 5000000000000);
}

export function on_receive_with_vault(sender_id: string, amount: u128, vault_id: u32, payload: String): ContractPromise {
    assert(context.predecessor == berriesContract(), "can only be called from token contract");

    if (payload.startsWith('sell:')) {
        const parts = payload.split(':');
        const nearAmount = u128.from(parts[1]);
        placeSellOrder(sender_id, amount, nearAmount);
        return withdrawFromVault(vault_id, context.contractName, amount);
    }

    assert(false, 'unexpected payload: ' + payload);
    // NOTE: Never happens, but is return value is required
    return withdrawFromVault(vault_id, sender_id, amount);
}

