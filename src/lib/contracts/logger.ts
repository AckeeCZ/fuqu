import { FuQuSubscriberOptions } from "../core/components/subscriber";

export interface Logger<MessageOptions, SubscriptionOptions, Message> {
  initializedPublisher?: (topicName: string) => {},
  publishedMessage?: (topicName: string, message: MessageOptions) => {},
  initializedSubscriber?: (subscriptionName: string, options: SubscriptionOptions & FuQuSubscriberOptions) => {},
  subscriberReconnected?: (subscriptionName: string, options: SubscriptionOptions & FuQuSubscriberOptions) => {},
  receivedMessage?: (subscriptionName: string, message: Message) => {},
  ackMessage?: (subscriptionName: string, message: Message) => {},
  nackMessage?: (subscriptionName: string, message: Message) => {},
}