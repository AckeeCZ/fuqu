import { FuQu } from '../index'

import test from 'ava'

let lastOptions: any = null
const pubsubMock = {
  topic: null as any,
  subscription: (_: any, options?: any) => {
    lastOptions = options
    return {
      on: (event: string, listener: (...args: any[]) => void) => {},
      removeAllListeners: () => {},
    }
  },
}
const fuQu = FuQu<unknown, any>(() => pubsubMock, {
  foo: 'default',
})
test('Subscription called with default options', t => {
  fuQu.createSubscriber('', () => {})
  t.is(lastOptions.foo, 'default')
  lastOptions = null
})
test('Default options get merged with additional', t => {
  fuQu.createSubscriber('', () => {}, { bar: 'op' })
  t.is(lastOptions.foo, 'default')
  t.is(lastOptions.bar, 'op')
  lastOptions = null
})
test('Additional options override default', t => {
  fuQu.createSubscriber('', () => {}, { foo: 'non-default' })
  t.is(lastOptions.foo, 'non-default')
  lastOptions = null
})
