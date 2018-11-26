
import { FuquCallback, FuquMessage, FuquOperations } from './Fuqu';

import { PubSub } from '@google-cloud/pubsub';

export interface GooglePubSubOptions {
    logger?: any;
    projectId: string;
    keyFilename: string;
    topicName: string;
}

export interface GooglePubSubRequestData {
    data: string | object;
}

export interface GooglePubSubMessage extends FuquMessage {
    ackId?: string;
    attributes?: object;
    connectionId?: string;
    length?: number;
    publishTime?: Date;
    received?: number;
}

export class GooglePubSub implements FuquOperations {
    private googlePubSub: any;
    private logger: any;
    private readonly topic: string;
    constructor(private options: GooglePubSubOptions) {
        this.googlePubSub = new PubSub(options);
        this.logger = options.logger || console;
        this.topic = options.topicName;
        this.initTopic()
            .then(() => this.initSubscription())
            .catch(() => this.initSubscription());
    }
    public in(data: GooglePubSubRequestData): Promise<any> {
        this.logger.info(`Publishing message ${data.data} to the ${this.topic} topic`);
        return Promise.resolve(this.googlePubSub
            .topic(this.topic)
            .publisher()
            .publish(Buffer.from(JSON.stringify(data.data)))
        );
    }
    public off(callback: FuquCallback<GooglePubSubMessage>) {
        this.logger.info('Trying to call subscription callback');
        this.googlePubSub.subscription(this.topic).on(`message`, callback);
    }
    private initTopic(): Promise<any> {
        this.logger.info(`Initializing the ${this.topic} topic`);
        return this.googlePubSub
            .createTopic(this.topic)
            .then(() => this.logger.info(`Topic ${this.topic} successfully created`))
            .catch((error: Error) => this.logger.error(`Topic ${this.topic} was not created: ${error.message}`));
    }
    private initSubscription(): Promise<any> {
        this.logger.info(`Initializing the ${this.topic} subscription`);
        return this.googlePubSub
            .topic(this.topic)
            .createSubscription(this.topic)
            .then(() => this.logger.info(`Subscription ${this.topic} successfully created`))
            .catch((error: Error) => this.logger.error(`Subscription ${this.topic} was not created: ${error.message}`));
    }
}
