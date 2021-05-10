import { BareEvent, Event, FinishedMessageMetadata, FuQu, FuQuOptions, Handler, IncomingMessageMetadata } from './fuqu';
import * as debug from 'debug';
import { FuQuPubSubOptions } from './adapters/pubsub';
import { MessageOptions } from '@google-cloud/pubsub/build/src/topic';
export type FuQuCreator<O extends FuQuOptions<any, any>, Message> = <
    Payload extends object,
    Attributes extends { [key: string]: string } = Record<any, any>,
    PublishMessageOptions = O extends FuQuPubSubOptions ? MessageOptions : never
>(
    client: any,
    topicName: string,
    options?: O
) => FuQu<Payload, Attributes, Message, PublishMessageOptions>;

export interface FuQuAdapter<P, A, M, PMO> {
    name: string;
    publishJson: (payload: P, attributes?: A, publishMessageOptions?: PMO) => Promise<void>;
    registerHandler: (handler: Handler<P, A, M>) => Promise<void> | void;
    ack: (message: M) => Promise<void> | void;
    nack: (message: M) => Promise<void> | void;
    close: () => Promise<void>;
    isAlive: () => Promise<boolean>;
    createIncomingMessageMetadata: (message: M, payload: P) => IncomingMessageMetadata<P, A>;
    createFinishedMessageMetadata: (
        incomingMetadata: IncomingMessageMetadata<P, A>,
        message: M
    ) => FinishedMessageMetadata<P, A>;
}

export const createFuQu = <P, A, M, PMO>(
    adapter: FuQuAdapter<P, A, M, PMO>,
    topicName: string,
    options?: FuQuOptions
): FuQu<P, A, M, PMO> => {
    const debugLog = debug(`fuqu:${topicName}`);
    const log = (justEvent: BareEvent<P, A>) => {
        const event = justEvent as Event<P, A>; // avoid spread, fill missing manually
        event.adapter = adapter.name,
        event.topicName = topicName,
        debugLog(event);
        options?.eventLogger?.(event);
    };
    log({ options, action: 'create' });
    return {
        publish: async (payload, attributes, publishOptions) => {
            await adapter.publishJson(payload, attributes, publishOptions);
            log({ payload, attributes, action: 'publish' });
        },
        subscribe: async handler => {
            log({  action: 'subscribe', handler: handler.name });
            const wrappedHandler: typeof handler = async (payload, attributes, message) => {
                const incomingMetadata = adapter.createIncomingMessageMetadata(message, payload);
                try {
                    log({
                        action: 'receive',
                        ...incomingMetadata,
                    }),
                        await handler(payload, attributes, message);
                    await adapter.ack(message);
                    log({
                        action: 'ack',
                        ...adapter.createFinishedMessageMetadata(incomingMetadata, message),
                    });
                } catch (error) {
                    await adapter.nack(message);
                    log({
                        error,
                        action: 'nack',
                        ...adapter.createFinishedMessageMetadata(incomingMetadata, message),
                    });
                }
            };
            await adapter.registerHandler(wrappedHandler);
        },
        close: async () => adapter.close().then(() => log({  action: 'close' })),
        isAlive: async (timeoutMillis = 10 * 1e3) => {
            const ok = await Promise.race<Promise<boolean>>([
                adapter.isAlive().catch(() => false),
                new Promise(resolve => setTimeout(() => resolve(false), timeoutMillis)),
            ]);
            log({  ok, action: 'hc' });
            return ok;
        },
    };
};
