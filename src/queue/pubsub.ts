import { Message, PubSub } from '@google-cloud/pubsub';
import { FuQuCreator, createFuQu } from '../fuquAdapter';
import { FuQuOptions } from '../fuqu';

type PublishOptions = Parameters<PubSub['topic']>[1];
type SubscriptionOptions = Parameters<PubSub['subscription']>[1];
interface FuQuPubSubOptions extends FuQuOptions {
    publishOptions?: PublishOptions;
    subscriptionOptions?: SubscriptionOptions;
}

export const createPubsubAdapter: FuQuCreator<FuQuPubSubOptions, Message> = (pubSub: PubSub, topicName, options) => {
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
    return createFuQu(
        {
            isAlive: () => subscription.then(s => s.isOpen),
            close: () => subscription.then(s => s.close()),
            publishJson: async (payload, attributes) => {
                await (await topic).publishJSON(payload, attributes);
            },
            registerHandler: async handler => {
                const sub = await subscription;
                sub.on('message', async (message: Message) => {
                    const payload = JSON.parse(message.data.toString());
                    await handler(payload, message);
                });
            },
            ack: msg => msg.ack(),
            nack: msg => msg.nack(),
            createIncomingMessageMetadata: (message, payload) => ({
                payload,
                published: new Date(message.publishTime.getTime()),
                received: new Date(message.received),
                deliveryAttempt: message.deliveryAttempt,
                attributes: message.attributes as any,
            }),
            createFinishedMessageMetadata: (message, incomingMetadata) => {
                const finished = new Date();
                return {
                    ...incomingMetadata,
                    finished,
                    publishToFinish: finished.getTime() - incomingMetadata.published.getTime(),
                    receivedToFinish: finished.getTime() - incomingMetadata.received.getTime(),
                };
            },
        },
        topicName,
        options
    );
};
