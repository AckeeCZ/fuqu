import { FuQuOptions, FuQu, Handler, IncomingMessageMetadata, FinishedMessageMetadata, Event } from './fuqu';

export type FuQuCreator<O extends FuQuOptions<any, any>, Message> = <
    Payload extends object,
    Attributes extends { [key: string]: string }
>(
    client: any,
    topicName: string,
    options?: O
) => FuQu<Payload, Attributes, Message>;

interface FuQuAdapter<P, A, M> {
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
    defs: FuQuAdapter<P, A, M>,
    topicName: string,
    options?: FuQuOptions
): FuQu<P, A, M> => {
    const debugLog = require('debug')(`fuqu:${topicName}`);
    const log = (event: Event<P, A>) => {
        debugLog(event)
        options?.eventLogger?.(event);
    }
    log({ topicName, action: 'create', options });
    return {
        publish: async (payload, attributes) => {
            await defs.publishJson(payload, attributes);
            log({ payload, attributes, topicName, action: 'publish' });
        },
        subscribe: async handler => {
            log({ topicName, action: 'subscribe', handler: handler.name });
            const wrappedHandler: typeof handler = async (payload, attributes, message) => {
                const incomingMetadata = defs.createIncomingMessageMetadata(message, payload);
                try {
                    log({
                        topicName,
                        action: 'receive',
                        ...incomingMetadata,
                    }),
                        await handler(payload, attributes, message);
                    await defs.ack(message);
                    log({
                        topicName,
                        action: 'ack',
                        ...defs.createFinishedMessageMetadata(message, incomingMetadata),
                    });
                } catch (error) {
                    await defs.nack(message);
                    log({
                        topicName,
                        action: 'nack',
                        error,
                        ...defs.createFinishedMessageMetadata(message, incomingMetadata),
                    });
                }
            };
            await defs.registerHandler(wrappedHandler);
        },
        close: async () => defs.close().then(() => log({ topicName, action: 'close' })),
        isAlive: async (timeoutMillis = 10 * 1e3) => {
            const ok = await Promise.race<Promise<boolean>>([
                defs.isAlive().catch(() => false),
                new Promise(resolve => setTimeout(() => resolve(false), timeoutMillis)),
            ]);
            log({ topicName, ok, action: 'hc' });
            return ok;
        },
    };
};
