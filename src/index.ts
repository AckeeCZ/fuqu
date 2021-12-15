
interface PubSubLike<A> {
  topic: (name: string) => {
    publishJSON: (payload: any, attributes: A) => Promise<string>
  }
  subscription: (name: string) => {
    on: (event: string, listener: (...args: any[]) => void) => any
    removeAllListeners: () => any
  }
}

type PubSubLikeClass<I, A> = { new (config: I): PubSubLike<A> }

export const FuQu = <I, A>(PubSub: PubSubLikeClass<I, A>, config: I) => {
  const createPublisher = (topicName: string) => {
    const client = new PubSub(config)
    const topic = client.topic(topicName)
    return {
      publish: topic.publishJSON.bind(topic),
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
