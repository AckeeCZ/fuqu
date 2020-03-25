import { FuQuCreator } from "./lib/fuquAdapter"
import { FuQu } from "./lib/fuqu"
import { fuQuPubSub } from "./lib/adapters/pubsub"
import { fuQuRabbit } from "./lib/adapters/rabbit"
import { fuQuMemory } from "./lib/adapters/memory"

interface FuckYou<P extends object, A extends Record<string, string>, M> extends FuQu<P, A, M> {
    in: FuQu<P, A, M>['publish'];
    off: FuQu<P, A, M>['subscribe'];
}

const makeInstanceReal = <P extends object, A extends Record<string, string>, M>(instance: FuQu<P, A, M>): FuckYou<P, A, M> => ({
    ...instance,
    in: instance.publish,
    off: instance.subscribe,
})

const makeReal = <O, M>(adapter: FuQuCreator<O, M>) => {
    return <P extends object, A extends Record<string, string>>(...args: Parameters<FuQuCreator<O, M>>) => makeInstanceReal(adapter(...args))
}

export const fuckPubSub = makeReal(fuQuPubSub)
export const fuckRabbit = makeReal(fuQuRabbit)
export const fuckMemory = makeReal(fuQuMemory)