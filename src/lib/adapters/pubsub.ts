import { MessageOptions } from '@google-cloud/pubsub/build/src/topic';
import { Message, PubSub, Subscription } from '@google-cloud/pubsub';
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
    let subscription: Promise<Subscription> | undefined;

    return createFuQu(
        {
            name: 'pubsub',
            isAlive: () =>
                subscription ? subscription.then((s) => s.isOpen) : topic.then((t) => t.get()).then((t) => !!t[0]),
            close: () => (subscription ? subscription.then((s) => s.close()) : Promise.resolve()),
            publishJson: async (payload, attributes, publishMessageOptions?: MessageOptions) => {
                await (await topic).publishMessage({ ...publishMessageOptions, attributes, json: payload })
            },
            registerHandler: async (handler) => {
                subscription = subscription ?? topic.then((t) =>
                    t
                        .subscription(topicName, options?.subscriptionOptions)
                        .get({ autoCreate: true })
                        .then((x) => {
                            if (options?.subscriptionOptions) {
                                x[0].setOptions(options?.subscriptionOptions);
                            }
                            return x[0];
                        })
                );
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
