import { FuQuSubscriberOptions, MessageHandler, Subscriber } from "./components/subscriber";
import { FuQuPublisher } from "./components/publisher";
import { MessageLike, SubscriptionOptionsLike } from "../contracts/pubsub";

export type FuQuInstance<
  MessageOptions,
  SubscriptionOptions extends SubscriptionOptionsLike,
> = {
  createPublisher: (topicName: string) => FuQuPublisher<MessageOptions>
  createSubscriber: <M extends MessageLike = MessageLike>(
    subscriptionName: string,
    handler: MessageHandler<M>,
    additionalSubscriptionOptions?: SubscriptionOptions & FuQuSubscriberOptions
  ) => Subscriber
}