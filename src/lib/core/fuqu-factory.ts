import { MessageLike, MessageOptionsLike, PubSubLike, SubscriptionOptionsLike } from "../contracts/pubsub";
import { FuQuInstance } from "./fuqu";
import { FuQuSubscriberOptions, Subscriber } from "./components/subscriber";
import { Logger } from "../contracts/logger";

export type FuQuOptions = FuQuSubscriberOptions & { logger?: Logger<any, any, any> }

export type FuQuFactory = <
  MessageOptions extends MessageOptionsLike,
  SubscriptionOptions extends SubscriptionOptionsLike,
>(
  createClient: () => PubSubLike<MessageOptions, SubscriptionOptions>,
  options?: SubscriptionOptions & FuQuOptions
) => FuQuInstance<MessageOptions, SubscriptionOptions>



export const FuQu: FuQuFactory = (
  createClient,
  options
) => {
  return {
    createPublisher: topicName => {
      const client = createClient()
      const topic = client.topic(topicName)
      options?.logger?.initializedPublisher?.(topicName)
      return {
        publish: async (messageOptions) => {
          options?.logger?.publishedMessage?.(topicName, messageOptions)
          const result = await topic.publishMessage(messageOptions)
          return String(result)
        },
      }
    },
    createSubscriber: (
      subscriptionName,
      handler,
      additionalSubscriptionOptions
    ) => {
      return new Subscriber(
        createClient,
        subscriptionName,
        handler,
        Object.assign(
          {},
          options,
          additionalSubscriptionOptions
        )
      )
    },
  }
}
