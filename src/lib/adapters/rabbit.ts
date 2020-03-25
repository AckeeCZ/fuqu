import { Connection, Channel, Message, Options } from 'amqplib';
import { FuQuCreator, createFuQu } from '../fuquAdapter';
import { FuQuOptions } from '../fuqu';
import { fuQuMemory } from './memory';

export interface FuQuRabbitOptions extends FuQuOptions {
    assertQueueOptions?: Options.AssertQueue
    consumeOptions?: Options.Consume
}

export const fuQuRabbit: FuQuCreator<FuQuRabbitOptions, Message> = (
    connection: Connection,
    topicName,
    options
) => {
    if (options?.useMock) {
        return fuQuMemory(undefined, topicName, options) as any;
    }
    const getChannel = (() => {
        let channel: Channel | undefined;
        return async () => {
            if (channel) return channel;
            channel = await connection.createChannel();
            await channel.assertQueue(topicName, options?.assertQueueOptions ?? {
                durable: false,
            });
            await channel.prefetch(options?.maxMessages ?? 0)
            return channel;
        };
    })();
    return createFuQu(
        {
            name: 'rabbit',
            isAlive: async () => {
                const channel = await getChannel();
                return !!(await channel.checkQueue(topicName));
            },
            close: async () => {
                await new Promise(setImmediate);
                const channel = await getChannel();
                await channel.close();
                await connection.close();
            },
            publishJson: async (payload, attributes) => {
                const channel = await getChannel();
                channel.sendToQueue(topicName, Buffer.from(JSON.stringify(payload)), { headers: attributes, timestamp: Date.now() });
            },
            registerHandler: async handler => {
                const channel = await getChannel();
                channel.consume(topicName, async message => {
                    if (!message) return;
                    const payload = JSON.parse(message.content.toString());
                    await handler(payload, message.properties.headers as any, message);
                }, options?.consumeOptions ?? {});
            },
            ack: msg => getChannel().then(channel => channel.ack(msg)),
            nack: msg => getChannel().then(channel => channel.nack(msg)),
            createIncomingMessageMetadata: (message, payload) => ({
                payload,
                publishTime: new Date(message.properties.timestamp),
                receiveTime: new Date(),
                attributes: message.properties.headers as any,
            }),
            createFinishedMessageMetadata: (message, incomingMetadata) => {
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
