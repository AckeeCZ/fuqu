import { FuQuOptions, FuQu, Handler, IncomingMessageMetadata, FinishedMessageMetadata } from './fuqu';

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
    registerHandler: (handler: Handler<P, M>) => Promise<void> | void;
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
    options?.eventLogger?.({ topicName, action: 'create', options });
    return {
        publish: async (payload, attributes) => {
            await defs.publishJson(payload, attributes);
            options?.eventLogger?.({ payload, attributes, topicName, action: 'publish' });
        },
        subscribe: async handler => {
            options?.eventLogger?.({ topicName, action: 'subscribe', handler: handler.name });
            const wrappedHandler: typeof handler = async (payload, message) => {
                const incomingMetadata = defs.createIncomingMessageMetadata(message, payload);
                try {
                    options?.eventLogger?.({
                        topicName,
                        action: 'receive',
                        ...incomingMetadata,
                    }),
                        await handler(payload, message);
                    await defs.ack(message);
                    options?.eventLogger?.({
                        topicName,
                        action: 'ack',
                        ...defs.createFinishedMessageMetadata(message, incomingMetadata),
                    });
                } catch (error) {
                    await defs.nack(message);
                    options?.eventLogger?.({
                        topicName,
                        action: 'nack',
                        error,
                        ...defs.createFinishedMessageMetadata(message, incomingMetadata),
                    });
                }
            };
            await defs.registerHandler(wrappedHandler);
        },
        close: async () => defs.close().then(() => options?.eventLogger?.({ topicName, action: 'close' })),
        isAlive: async (timeoutMillis = 10 * 1e3) => {
            const ok = await Promise.race<Promise<boolean>>([
                defs.isAlive().catch(() => false),
                new Promise(resolve => setTimeout(() => resolve(false), timeoutMillis)),
            ]);
            options?.eventLogger?.({ topicName, ok, action: 'hc' });
            return ok;
        },
    };
};
