import { FuQuSubscriberOptions } from "../core/components/subscriber";

export interface Logger<MessageOptions, SubscriptionOptions, Message> {
  initializedPublisher?: (topicName: string) => void,
  publishedMessage?: (topicName: string, message: MessageOptions) => void,
  initializedSubscriber?: (subscriptionName: string, options: SubscriptionOptions & FuQuSubscriberOptions) => void,
  subscriberReconnected?: (subscriptionName: string, options: SubscriptionOptions & FuQuSubscriberOptions) => void,
  receivedMessage?: (subscriptionName: string, message: Message) => void,
  ackMessage?: (subscriptionName: string, message: Message) => void,
  nackMessage?: (subscriptionName: string, message: Message, reason: any) => void,
}