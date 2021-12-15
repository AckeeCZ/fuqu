
interface PubSubLike<MessageOptions> {
  topic: (name: string) => {
    publishMessage: (options: MessageOptions) => Promise<[string]>
  }
  subscription: (name: string) => {
    on: (event: string, listener: (...args: any[]) => void) => any
    removeAllListeners: () => any
  }
}
type PubSubLikeClass<I, MessageOptions> = { new (config: I): PubSubLike<MessageOptions> }

interface MessageLike {
  ack(): void;
  nack(): void;
}
type ClassType<InstanceType> = { new (...args: any[]): InstanceType }

type MessageHandler<M extends MessageLike> = (message: M) => void

export const FuQu = <I, MessageOptions, Message extends MessageLike>(PubSub: PubSubLikeClass<I, MessageOptions>, config: I, Message: ClassType<Message>) => {
  const createPublisher = (topicName: string) => {
    const client = new PubSub(config)
    const topic = client.topic(topicName)
    return {
      publish: topic.publishMessage.bind(topic)
    }
  }
  const createSubscriber = (subscriptionName: string, handler: MessageHandler<Message>) => {
    const client = new PubSub(config)
    const subscription = client.subscription(subscriptionName)
    subscription.on('message', handler)
    return {
      clear: () => subscription.removeAllListeners()
    }
  }
  return {
    createPublisher,
    createSubscriber,
  }
}
