import { fuQuMemory } from './lib/adapters/memory';
import { fuQuPubSub } from './lib/adapters/pubsub';
import { fuQuRabbit } from './lib/adapters/rabbit';
import { FuQu } from './lib/fuqu';
import { FuQuCreator } from './lib/fuquAdapter';

interface FuckYou<P extends object, A extends Record<string, string>, M, PO> extends FuQu<P, A, M, PO> {
    in: FuQu<P, A, M, PO>['publish'];
    off: FuQu<P, A, M, PO>['subscribe'];
}

const makeInstanceReal = <P extends object, A extends Record<string, string>, M, PO>(instance: FuQu<P, A, M, PO>): FuckYou<P, A, M, PO> => ({
    ...instance,
    in: instance.publish,
    off: instance.subscribe,
});

const makeReal = <O, M, PO>(adapter: FuQuCreator<O, M>) => {
    return <P extends object, A extends Record<string, string>>(...args: Parameters<FuQuCreator<O, M>>) => makeInstanceReal<P, A, M, PO>(adapter(...args));
};

export const fuckPubSub = makeReal(fuQuPubSub);
export const fuckRabbit = makeReal(fuQuRabbit);
export const fuckMemory = makeReal(fuQuMemory);
