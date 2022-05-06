import { FuQuMessage, FuQuSubscriberOptions } from "../core/components/subscriber";
import { MessageLike } from "./pubsub";

export interface Logger<MessageOptions, SubscriptionOptions, Message extends MessageLike> {
  initializedPublisher?: (topicName: string) => void,
  publishedMessage?: (topicName: string, message: MessageOptions) => void,
  initializedSubscriber?: (subscriptionName: string, options: SubscriptionOptions & FuQuSubscriberOptions) => void,
  subscriberReconnected?: (subscriptionName: string, options: SubscriptionOptions & FuQuSubscriberOptions) => void,
  receivedMessage?: (subscriptionName: string, message: FuQuMessage<Message>) => void,
  ackMessage?: (subscriptionName: string, message: FuQuMessage<Message>) => void,
  nackMessage?: (subscriptionName: string, message: FuQuMessage<Message>, reason: any) => void,
  error?: (subscriptionName: string, error: Error) => void,
}