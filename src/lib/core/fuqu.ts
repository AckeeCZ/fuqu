import { FuQuSubscriberOptions, MessageHandler, Subscriber } from "./components/subscriber";
import { FuQuPublisher } from "./components/publisher";
import { MessageLike, SubscriptionOptionsLike } from "../contracts/pubsub";

export type FuQuInstance<
  MessageOptions,
  SubscriptionOptions extends SubscriptionOptionsLike,
  Message extends MessageLike
> = {
  createPublisher: (topicName: string) => FuQuPublisher<MessageOptions>
  createSubscriber: (
    subscriptionName: string,
    handler: MessageHandler<Message>,
    additionalSubscriptionOptions?: SubscriptionOptions & FuQuSubscriberOptions
  ) => Subscriber
}