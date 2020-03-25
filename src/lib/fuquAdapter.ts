import { FuQuOptions, FuQu, Handler, IncomingMessageMetadata, FinishedMessageMetadata, Event, BareEvent } from './fuqu';

export type FuQuCreator<O extends FuQuOptions<any, any>, Message> = <
    Payload extends object,
    Attributes extends { [key: string]: string }
>(
    client: any,
    topicName: string,
    options?: O
) => FuQu<Payload, Attributes, Message>;

export interface FuQuAdapter<P, A, M> {
    name: string;
    publishJson: (payload: P, attributes?: A) => Promise<void>;
    registerHandler: (handler: Handler<P, A, M>) => Promise<void> | void;
    ack: (message: M) => Promise<void> | void;
    nack: (message: M) => Promise<void> | void;
    close: () => Promise<void>;
    isAlive: () => Promise<boolean>;
    createIncomingMessageMetadata: (message: M, payload: P) => IncomingMessageMetadata<P, A>;
    createFinishedMessageMetadata: (
        message: M,
        incomingMetadata: IncomingMessageMetadata<P, A>
    ) => FinishedMessageMetadata<P, A>;
}

export const createFuQu = <P, A, M>(
    adapter: FuQuAdapter<P, A, M>,
    topicName: string,
    options?: FuQuOptions
): FuQu<P, A, M> => {
    const debugLog = require('debug')(`fuqu:${topicName}`);
    const log = (justEvent: BareEvent<P, A>) => {
        const event = justEvent as Event<P, A>; // avoid spread, fill missing manually
        event.adapter = adapter.name,
        event.topicName = topicName,
        debugLog(event)
        options?.eventLogger?.(event);
    }
    log({ topicName, adapter: adapter.name, action: 'create', options });
    return {
        publish: async (payload, attributes) => {
            await adapter.publishJson(payload, attributes);
            log({ payload, attributes, topicName, adapter: adapter.name, action: 'publish' });
        },
        subscribe: async handler => {
            log({ topicName, adapter: adapter.name, action: 'subscribe', handler: handler.name });
            const wrappedHandler: typeof handler = async (payload, attributes, message) => {
                const incomingMetadata = adapter.createIncomingMessageMetadata(message, payload);
                try {
                    log({
                        topicName, adapter: adapter.name,
                        action: 'receive',
                        ...incomingMetadata,
                    }),
                        await handler(payload, attributes, message);
                    await adapter.ack(message);
                    log({
                        topicName, adapter: adapter.name,
                        action: 'ack',
                        ...adapter.createFinishedMessageMetadata(message, incomingMetadata),
                    });
                } catch (error) {
                    await adapter.nack(message);
                    log({
                        topicName, adapter: adapter.name,
                        action: 'nack',
                        error,
                        ...adapter.createFinishedMessageMetadata(message, incomingMetadata),
                    });
                }
            };
            await adapter.registerHandler(wrappedHandler);
        },
        close: async () => adapter.close().then(() => log({ topicName, adapter: adapter.name, action: 'close' })),
        isAlive: async (timeoutMillis = 10 * 1e3) => {
            const ok = await Promise.race<Promise<boolean>>([
                adapter.isAlive().catch(() => false),
                new Promise(resolve => setTimeout(() => resolve(false), timeoutMillis)),
            ]);
            log({ topicName, adapter: adapter.name, ok, action: 'hc' });
            return ok;
        },
    };
};
