
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

export const FuQu = <I, MessageOptions>(PubSub: PubSubLikeClass<I, MessageOptions>, config: I) => {
  const createPublisher = (topicName: string) => {
    const client = new PubSub(config)
    const topic = client.topic(topicName)
    return {
      publish: topic.publishMessage.bind(topic)
    }
  }
  const createSubscriber = (subscriptionName: string, handler: any) => {
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
