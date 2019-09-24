
import { Message as PubSubMessage, PubSub, Subscription, SubscriptionOptions, Topic } from '@google-cloud/pubsub';
import { ClientConfig } from '@google-cloud/pubsub/build/src/pubsub';
import Logger from '../Logger';
import { FuquBaseOptions, FuquOperations } from './Fuqu';

// https://cloud.google.com/nodejs/docs/reference/pubsub/0.23.x/Subscription
const defaultMaxMessages = 100; // By default Subscription objects allow you to process 100 messages at the same time

export interface GooglePubSubOptions extends FuquBaseOptions, ClientConfig {
    logger?: any;
    debug?: boolean;
    topicName: string;
}

export interface GooglePubSubRequestData {
    data: string | object;
}

export type OriginalMessage = PubSubMessage;

export class GooglePubSub<D extends object> implements FuquOperations<D, PubSubMessage> {
    private googlePubSub: PubSub;
    private logger: Logger;
    private readonly topic: Promise<Topic>;
    private readonly subscription: Promise<Subscription>;
    private readonly topicName: string;
    private readonly debug: boolean;
    constructor(options: GooglePubSubOptions) {
        this.googlePubSub = new PubSub(options);
        this.logger = new Logger(options.logger || console, !!options.debug);
        this.debug = !!options.debug;
        this.topicName = options.topicName;
        this.topic = this.initTopic();
        this.subscription = this.initSubscription(GooglePubSub.getSubscriptionOptions(options));
    }
    public in: FuquOperations<D, PubSubMessage>['in'] = async data => {
        this.logger.logDebug(`Publishing message to the '${this.topicName}' topic`, data);
        try {
            typeof data === 'string'
                ? (await this.topic)
                    .publish(Buffer.from(JSON.stringify(data)))
                : (await this.topic)
                    .publishJSON(data);
            this.logger.logDebug(`Message successfully published to the '${this.topicName}' topic`, data);
        } catch (e) {
            this.logger.logError(`Message publishing to the '${this.topicName}' topic failed: ${e.message}`, e);
        }
    }
    public off: FuquOperations<D, PubSubMessage>['off'] = async cb => {
        this.logger.logDebug(`Trying to register subscription '${this.topicName}' callback`);
        (await this.subscription).on(`message`, (message: PubSubMessage) => {
            cb({
                id: message.id,
                data: JSON.parse(message.data.toString()),
                ack: () => message.ack(),
                nack: () => message.nack(),
                original: message,
            });
        });
        this.logger.logDebug(`Listening on ${this.topicName} ... ready for fuq ...`);
    }
    private async initTopic() {
        this.logger.logDebug(`Initializing the '${this.topicName}' topic`);
        const [topic] = await (await this.googlePubSub).topic(this.topicName).get({ autoCreate: true });
        return topic;
    }
    private async initSubscription(subscriptionOptions?: SubscriptionOptions) {
        this.logger.logDebug(`Initializing the '${this.topicName}' subscription`);
        const [subscription] = await (await this.topic).subscription(this.topicName, subscriptionOptions).get({ autoCreate: true });
        return subscription;
    }
    private static getSubscriptionOptions(queueOptions?: FuquBaseOptions) {
        if (queueOptions && queueOptions.queue) {
            return {
                flowControl: {
                    allowExcessMessages: false,
                    maxMessages: queueOptions.queue.maxMessages || defaultMaxMessages,
                },
            };
        }
    }
}
