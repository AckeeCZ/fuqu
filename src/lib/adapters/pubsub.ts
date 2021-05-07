import { Message, PubSub } from '@google-cloud/pubsub';
import { FuQuOptions } from '../fuqu';
import { createFuQu, FuQuCreator } from '../fuquAdapter';
import { fuQuMemory } from './memory';

type PublishOptions = Parameters<PubSub['topic']>[1];
type SubscriptionOptions = Parameters<PubSub['subscription']>[1];
export interface FuQuPubSubOptions extends FuQuOptions {
    publishOptions?: PublishOptions;
    subscriptionOptions?: SubscriptionOptions;
}

export const fuQuPubSub: FuQuCreator<FuQuPubSubOptions, Message> = (pubSub: PubSub, topicName, options) => {
    if (options?.useMock) {
        return fuQuMemory(undefined, topicName, options) as any;
    }
    if (options?.maxMessages) {
        options.subscriptionOptions = {
            ...options.subscriptionOptions,
            flowControl: {
                ...options.subscriptionOptions?.flowControl,
                maxMessages: options?.maxMessages,
                allowExcessMessages: false,
            },
        };
    }
    const topic = pubSub
        .topic(topicName, options?.publishOptions)
        .get({ autoCreate: true })
        .then(x => {
            if (options?.publishOptions) {
                x[0].setPublishOptions(options?.publishOptions);
            }
            return x[0];
        });
    const subscription = topic.then(topic =>
        topic
            .subscription(topicName, options?.subscriptionOptions)
            .get({ autoCreate: true })
            .then(x => {
                if (options?.subscriptionOptions) {
                    x[0].setOptions(options?.subscriptionOptions);
                }
                return x[0];
            })
    );
    return createFuQu(
        {
            name: 'pubsub',
            isAlive: () => subscription.then(s => s.isOpen),
            close: () => subscription.then(s => s.close()),
            publishJson: async (payload, attributes, publishOptions) => {
                await (await topic).publishMessage({ attributes, json: payload, orderingKey: publishOptions?.orderingKey })
            },
            registerHandler: async handler => {
                const sub = await subscription;
                sub.on('message', async (message: Message) => {
                    const payload = JSON.parse(message.data.toString());
                    await handler(payload, message.attributes as any, message);
                });
            },
            ack: msg => msg.ack(),
            nack: msg => msg.nack(),
            createIncomingMessageMetadata: (message, payload) => ({
                payload,
                publishTime: new Date(message.publishTime.getTime()),
                receiveTime: new Date(message.received),
                attributes: message.attributes as any,
            }),
            createFinishedMessageMetadata: incomingMetadata => {
                const finished = new Date();
                return {
                    ...incomingMetadata,
                    finishTime: finished,
                    totalDurationMillis: finished.getTime() - incomingMetadata.publishTime.getTime(),
                    processDurationMillis: finished.getTime() - incomingMetadata.receiveTime.getTime(),
                };
            },
        },
        topicName,
        options
    );
};
