import {
  FuQuSubscriberOptions,
  MessageHandler,
  Subscriber,
} from './components/subscriber'
import { FuQuPublisher } from './components/publisher'
import {
  MessageLike,
  SubscriptionOptionsLike,
  MessageOptionsLike,
} from '../contracts/pubsub'
import { OverrideJsonType } from './components/helpers'

export type FuQuInstance<
  MessageOptions extends MessageOptionsLike,
  SubscriptionOptions extends SubscriptionOptionsLike
> = {
  createPublisher: <JsonType = any>(
    topicName: string
  ) => FuQuPublisher<OverrideJsonType<MessageOptions, JsonType>>
  createSubscriber: <M extends MessageLike = MessageLike>(
    subscriptionName: string,
    handler: MessageHandler<M>,
    additionalSubscriptionOptions?: SubscriptionOptions & FuQuSubscriberOptions
  ) => Subscriber
}
