import { inspectWithPreamble } from 'intspector';

describe('Fuqu', () => {
    test('Types match', () => {
        const fuquInspect = inspectWithPreamble(`
    import { FuQu } from './src/lib/fuqu';
    type MyFuQu = FuQu<{ foo: number }, { v: string }, { data: string, meta: Record<string, string> }>;`);
        const res = fuquInspect({
            handlerParams: 'Parameters<Parameters<MyFuQu["subscribe"]>[0]>',
            publishParams: 'Parameters<MyFuQu["publish"]>',
        });
        expect(res.handlerParams).toMatchInlineSnapshot(
            '"[{ foo: number; }, { v: string; }, { data: string; meta: Record<string, string>; }]"'
        );
        expect(res.publishParams).toMatchInlineSnapshot('"[{ foo: number; }, ({ v: string; } | undefined)?, ({ [key: string]: any; } | undefined)?]"');
    });
});
