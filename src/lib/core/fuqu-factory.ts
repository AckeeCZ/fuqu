import { MessageLike, PubSubLike, SubscriptionOptionsLike } from "../contracts/pubsub";
import { FuQuInstance } from "./fuqu";
import { FuQuSubscriberOptions, Subscriber } from "./components/subscriber";
import { ClassType } from "../utils/type-utils";

export type FuQuFactory = <
  MessageOptions,
  SubscriptionOptions extends SubscriptionOptionsLike,
  Message extends MessageLike
>(
  createClient: () => PubSubLike<MessageOptions, SubscriptionOptions>,
  Message: ClassType<Message>,
  defaultSubscriptionOptions?: SubscriptionOptions & FuQuSubscriberOptions
) => FuQuInstance<MessageOptions, SubscriptionOptions, Message>



export const FuQu: FuQuFactory = (
  createClient,
  _Message,
  defaultSubscriptionOptions
) => {
  return {
    createPublisher: topicName => {
      const client = createClient()
      const topic = client.topic(topicName)
      return {
        publish: topic.publishMessage.bind(topic),
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
          defaultSubscriptionOptions,
          additionalSubscriptionOptions
        )
      )
    },
  }
}
