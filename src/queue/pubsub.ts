import { Attributes, Message, PubSub } from '@google-cloud/pubsub';

type PublishOptions = Parameters<PubSub['topic']>[1];
type SubscriptionOptions = Parameters<PubSub['subscription']>[1];

type MessageData<M> = {
    payload: M;
    attributes?: Attributes;
};
type IncomingMessageMetadata<M> = MessageData<M> & {
    published: Date;
    deliveryAttempt: number;
    received: Date;
};
type FinishedMessageMetadata<M> = IncomingMessageMetadata<M> & {
    finished: Date;
    publishToFinish: number;
    receivedToFinish: number;
};
type Event<M> = { topicName: string } & (
    | { action: 'create'; options: any }
    | { action: 'hc'; ok: boolean }
    | { action: 'close' }
    | { action: 'subscribe'; handler: string }
    | (MessageData<M> & { action: 'publish' })
    | (IncomingMessageMetadata<M> & {
        action: 'receive';
    })
    | (FinishedMessageMetadata<M> & {
        action: 'ack';
    })
    | (FinishedMessageMetadata<M> & {
        action: 'nack';
        error: any;
    })
);

const createIncomingMessageMetadata = (message: Message, payload: any): IncomingMessageMetadata<any> => ({
    payload,
    published: new Date(message.publishTime.getTime()),
    received: new Date(message.received),
    deliveryAttempt: message.deliveryAttempt,
    attributes: message.attributes,
});

const createFinishedMessageMetadata = (
    incomingMessageMetadata: IncomingMessageMetadata<any>
): FinishedMessageMetadata<any> => {
    const finished = new Date();
    return {
        ...incomingMessageMetadata,
        finished,
        publishToFinish: finished.getTime() - incomingMessageMetadata.published.getTime(),
        receivedToFinish: finished.getTime() - incomingMessageMetadata.received.getTime(),
    };
};

export type FuquPubSubOptions = {
    publishOptions?: PublishOptions;
    subscriptionOptions?: SubscriptionOptions;
    eventLogger?: (event: Event<any>) => void;
};

export const createPubsubAdapter = <M extends object>(pubSub: PubSub, topicName: string, options?: FuquPubSubOptions) => {
    const topic = pubSub
        .topic(topicName, options?.publishOptions)
        .get({ autoCreate: true })
        .then(x => x[0]);
    const subscription = topic.then(topic =>
        topic
            .subscription(topicName, options?.subscriptionOptions)
            .get({ autoCreate: true })
            .then(x => x[0])
    );
    /**
     * Publish a message
     * @param payload Object-like message payload
     * @param attributes Optional message attributes
     */
    const publish = async (payload: M, attributes?: Attributes) => {
        (await topic).publishJSON(payload, attributes);
        options?.eventLogger?.({ payload, attributes, topicName, action: 'publish' });
    };
    /**
     * Subscribe a message receiver
     * @param handler Async handler that is given data and original message.
     * When handler is finished, message is automatically ack-ed. Throwing
     * an error inside the handler results in nack-ing the message. The
     * handler is awaited to respond to errors but result value ignored.
     */
    const subscribe = async (handler: (data: M, message: Message) => Promise<void> | void) => {
        options?.eventLogger?.({ topicName, action: 'subscribe', handler: handler.name });
        (await subscription).on('message', async (message: Message) => {
            const payload = JSON.parse(message.data.toString());
            const incomingMetadata = createIncomingMessageMetadata(message, payload);
            options?.eventLogger?.({
                topicName,
                action: 'receive',
                ...incomingMetadata,
            });
            try {
                await handler(payload, message);
                message.ack();
                options?.eventLogger?.({
                    topicName,
                    action: 'ack',
                    ...createFinishedMessageMetadata(incomingMetadata),
                });
            } catch (error) {
                message.nack();
                options?.eventLogger?.({
                    topicName,
                    error,
                    action: 'nack',
                    ...createFinishedMessageMetadata(incomingMetadata),
                });
            }
        });
    };
    /**
     * Test if connection is alive (check if subscription exists)
     * @param timeoutMs Timeout to wait for the response
     */
    const isAlive = async (timeoutMs = 10 * 1e3) => {
        const ok = await Promise.race<Promise<boolean>>([
            subscription
                .then(s => s.exists())
                .then(res => res[0])
                .catch(() => false),
            new Promise(resolve => setTimeout(() => resolve(false), timeoutMs)),
        ]);
        options?.eventLogger?.({ topicName, ok, action: 'hc' });
    };
    /**
     * Close all active connections ()
     */
    const close = async () => (await subscription).close().then(() => options?.eventLogger?.({ topicName, action: 'close' }));
    options?.eventLogger?.({ topicName, options, action: 'create' });
    return { publish, subscribe, isAlive, close };
};
