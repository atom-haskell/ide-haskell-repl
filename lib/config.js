"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = {
    defaultRepl: {
        type: 'string',
        enum: ['stack', 'cabal-v1', 'ghci', 'cabal-v2'],
        default: 'ghci',
        order: 0,
    },
    stackPath: {
        type: 'string',
        default: 'stack',
        description: 'Path to stack executable',
        order: 10,
    },
    cabalPath: {
        type: 'string',
        default: 'cabal',
        description: 'Path to cabal executable',
        order: 20,
    },
    legacyCabalV1: {
        type: 'boolean',
        default: 'false',
        description: 'Enable if using cabal-install < 2.4.0.0 and wish to use `cabal repl`',
        order: 21,
    },
    ghciPath: {
        type: 'string',
        default: 'ghci',
        description: 'Path to ghci executable',
        order: 30,
    },
    extraArgs: {
        type: 'array',
        default: [],
        description: 'Extra arguments passed to ghci. Comma-separated',
        items: {
            type: 'string',
        },
        order: 40,
    },
    autoReloadRepeat: {
        type: 'boolean',
        default: false,
        description: `Automatically reload and repeat last command on file save.
    This is only the default. You can toggle this per-editor using
    ide-haskell-repl:toggle-auto-reload-repeat command`,
        order: 50,
    },
    maxMessages: {
        type: 'number',
        default: 100,
        minimum: 0,
        description: `Maximum number of ghci messages shown. 0 means unlimited.`,
        order: 60,
    },
    errorsInOutput: {
        type: 'boolean',
        default: true,
        description: `Show interactive errors in output window.`,
        order: 65,
    },
    showTypes: {
        type: 'boolean',
        default: false,
        description: `Show type tooltips in ide-haskell if possible`,
        order: 70,
    },
    checkOnSave: {
        type: 'boolean',
        default: false,
        description: `Reload project in background when file is saved, will effectively
    check for errors`,
        order: 80,
    },
    ghciWrapperPath: {
        type: 'string',
        default: '',
        description: `This is intended to fix the 'interrupt closes ghci' problem
    on Windows -- see README for details. This option has no effect on
    other platforms`,
        order: 999,
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFXLFFBQUEsTUFBTSxHQUFHO0lBQ2xCLFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxRQUFRO1FBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDO1FBQy9DLE9BQU8sRUFBRSxNQUFNO1FBQ2YsS0FBSyxFQUFFLENBQUM7S0FDVDtJQUNELFNBQVMsRUFBRTtRQUNULElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLE9BQU87UUFDaEIsV0FBVyxFQUFFLDBCQUEwQjtRQUN2QyxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsT0FBTztRQUNoQixXQUFXLEVBQUUsMEJBQTBCO1FBQ3ZDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxhQUFhLEVBQUU7UUFDYixJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLFdBQVcsRUFDVCxzRUFBc0U7UUFDeEUsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFFBQVEsRUFBRTtRQUNSLElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLE1BQU07UUFDZixXQUFXLEVBQUUseUJBQXlCO1FBQ3RDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxTQUFTLEVBQUU7UUFDVCxJQUFJLEVBQUUsT0FBTztRQUNiLE9BQU8sRUFBRSxFQUFFO1FBQ1gsV0FBVyxFQUFFLGlEQUFpRDtRQUM5RCxLQUFLLEVBQUU7WUFDTCxJQUFJLEVBQUUsUUFBUTtTQUNmO1FBQ0QsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUU7O3VEQUVzQztRQUNuRCxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsV0FBVyxFQUFFO1FBQ1gsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsR0FBRztRQUNaLE9BQU8sRUFBRSxDQUFDO1FBQ1YsV0FBVyxFQUFFLDJEQUEyRDtRQUN4RSxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsY0FBYyxFQUFFO1FBQ2QsSUFBSSxFQUFFLFNBQVM7UUFDZixPQUFPLEVBQUUsSUFBSTtRQUNiLFdBQVcsRUFBRSwyQ0FBMkM7UUFDeEQsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFNBQVMsRUFBRTtRQUNULElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUUsK0NBQStDO1FBQzVELEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxXQUFXLEVBQUU7UUFDWCxJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxLQUFLO1FBQ2QsV0FBVyxFQUFFO3FCQUNJO1FBQ2pCLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxlQUFlLEVBQUU7UUFDZixJQUFJLEVBQUUsUUFBUTtRQUNkLE9BQU8sRUFBRSxFQUFFO1FBQ1gsV0FBVyxFQUFFOztvQkFFRztRQUNoQixLQUFLLEVBQUUsR0FBRztLQUNYO0NBQ0YsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBsZXQgY29uZmlnID0ge1xuICBkZWZhdWx0UmVwbDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGVudW06IFsnc3RhY2snLCAnY2FiYWwtdjEnLCAnZ2hjaScsICdjYWJhbC12MiddLFxuICAgIGRlZmF1bHQ6ICdnaGNpJyxcbiAgICBvcmRlcjogMCxcbiAgfSxcbiAgc3RhY2tQYXRoOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZGVmYXVsdDogJ3N0YWNrJyxcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gc3RhY2sgZXhlY3V0YWJsZScsXG4gICAgb3JkZXI6IDEwLFxuICB9LFxuICBjYWJhbFBhdGg6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBkZWZhdWx0OiAnY2FiYWwnLFxuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBjYWJhbCBleGVjdXRhYmxlJyxcbiAgICBvcmRlcjogMjAsXG4gIH0sXG4gIGxlZ2FjeUNhYmFsVjE6IHtcbiAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgZGVmYXVsdDogJ2ZhbHNlJyxcbiAgICBkZXNjcmlwdGlvbjpcbiAgICAgICdFbmFibGUgaWYgdXNpbmcgY2FiYWwtaW5zdGFsbCA8IDIuNC4wLjAgYW5kIHdpc2ggdG8gdXNlIGBjYWJhbCByZXBsYCcsXG4gICAgb3JkZXI6IDIxLFxuICB9LFxuICBnaGNpUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICdnaGNpJyxcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gZ2hjaSBleGVjdXRhYmxlJyxcbiAgICBvcmRlcjogMzAsXG4gIH0sXG4gIGV4dHJhQXJnczoge1xuICAgIHR5cGU6ICdhcnJheScsXG4gICAgZGVmYXVsdDogW10sXG4gICAgZGVzY3JpcHRpb246ICdFeHRyYSBhcmd1bWVudHMgcGFzc2VkIHRvIGdoY2kuIENvbW1hLXNlcGFyYXRlZCcsXG4gICAgaXRlbXM6IHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIH0sXG4gICAgb3JkZXI6IDQwLFxuICB9LFxuICBhdXRvUmVsb2FkUmVwZWF0OiB7XG4gICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgIGRlc2NyaXB0aW9uOiBgQXV0b21hdGljYWxseSByZWxvYWQgYW5kIHJlcGVhdCBsYXN0IGNvbW1hbmQgb24gZmlsZSBzYXZlLlxuICAgIFRoaXMgaXMgb25seSB0aGUgZGVmYXVsdC4gWW91IGNhbiB0b2dnbGUgdGhpcyBwZXItZWRpdG9yIHVzaW5nXG4gICAgaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0IGNvbW1hbmRgLFxuICAgIG9yZGVyOiA1MCxcbiAgfSxcbiAgbWF4TWVzc2FnZXM6IHtcbiAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICBkZWZhdWx0OiAxMDAsXG4gICAgbWluaW11bTogMCxcbiAgICBkZXNjcmlwdGlvbjogYE1heGltdW0gbnVtYmVyIG9mIGdoY2kgbWVzc2FnZXMgc2hvd24uIDAgbWVhbnMgdW5saW1pdGVkLmAsXG4gICAgb3JkZXI6IDYwLFxuICB9LFxuICBlcnJvcnNJbk91dHB1dDoge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiB0cnVlLFxuICAgIGRlc2NyaXB0aW9uOiBgU2hvdyBpbnRlcmFjdGl2ZSBlcnJvcnMgaW4gb3V0cHV0IHdpbmRvdy5gLFxuICAgIG9yZGVyOiA2NSxcbiAgfSxcbiAgc2hvd1R5cGVzOiB7XG4gICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgIGRlc2NyaXB0aW9uOiBgU2hvdyB0eXBlIHRvb2x0aXBzIGluIGlkZS1oYXNrZWxsIGlmIHBvc3NpYmxlYCxcbiAgICBvcmRlcjogNzAsXG4gIH0sXG4gIGNoZWNrT25TYXZlOiB7XG4gICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgIGRlc2NyaXB0aW9uOiBgUmVsb2FkIHByb2plY3QgaW4gYmFja2dyb3VuZCB3aGVuIGZpbGUgaXMgc2F2ZWQsIHdpbGwgZWZmZWN0aXZlbHlcbiAgICBjaGVjayBmb3IgZXJyb3JzYCxcbiAgICBvcmRlcjogODAsXG4gIH0sXG4gIGdoY2lXcmFwcGVyUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICcnLFxuICAgIGRlc2NyaXB0aW9uOiBgVGhpcyBpcyBpbnRlbmRlZCB0byBmaXggdGhlICdpbnRlcnJ1cHQgY2xvc2VzIGdoY2knIHByb2JsZW1cbiAgICBvbiBXaW5kb3dzIC0tIHNlZSBSRUFETUUgZm9yIGRldGFpbHMuIFRoaXMgb3B0aW9uIGhhcyBubyBlZmZlY3Qgb25cbiAgICBvdGhlciBwbGF0Zm9ybXNgLFxuICAgIG9yZGVyOiA5OTksXG4gIH0sXG59XG5cbi8vIGdlbmVyYXRlZCBieSB0eXBlZC1jb25maWcuanNcbmRlY2xhcmUgbW9kdWxlICdhdG9tJyB7XG4gIGludGVyZmFjZSBDb25maWdWYWx1ZXMge1xuICAgICdpZGUtaGFza2VsbC1yZXBsLmRlZmF1bHRSZXBsJzogJ3N0YWNrJyB8ICdjYWJhbC12MScgfCAnZ2hjaScgfCAnY2FiYWwtdjInXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuc3RhY2tQYXRoJzogc3RyaW5nXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuY2FiYWxQYXRoJzogc3RyaW5nXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwubGVnYWN5Q2FiYWxWMSc6IGJvb2xlYW5cbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5naGNpUGF0aCc6IHN0cmluZ1xuICAgICdpZGUtaGFza2VsbC1yZXBsLmV4dHJhQXJncyc6IHN0cmluZ1tdXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuYXV0b1JlbG9hZFJlcGVhdCc6IGJvb2xlYW5cbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5tYXhNZXNzYWdlcyc6IG51bWJlclxuICAgICdpZGUtaGFza2VsbC1yZXBsLmVycm9yc0luT3V0cHV0JzogYm9vbGVhblxuICAgICdpZGUtaGFza2VsbC1yZXBsLnNob3dUeXBlcyc6IGJvb2xlYW5cbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5jaGVja09uU2F2ZSc6IGJvb2xlYW5cbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5naGNpV3JhcHBlclBhdGgnOiBzdHJpbmdcbiAgICAnaWRlLWhhc2tlbGwtcmVwbCc6IHtcbiAgICAgIGRlZmF1bHRSZXBsOiAnc3RhY2snIHwgJ2NhYmFsLXYxJyB8ICdnaGNpJyB8ICdjYWJhbC12MidcbiAgICAgIHN0YWNrUGF0aDogc3RyaW5nXG4gICAgICBjYWJhbFBhdGg6IHN0cmluZ1xuICAgICAgbGVnYWN5Q2FiYWxWMTogYm9vbGVhblxuICAgICAgZ2hjaVBhdGg6IHN0cmluZ1xuICAgICAgZXh0cmFBcmdzOiBzdHJpbmdbXVxuICAgICAgYXV0b1JlbG9hZFJlcGVhdDogYm9vbGVhblxuICAgICAgbWF4TWVzc2FnZXM6IG51bWJlclxuICAgICAgZXJyb3JzSW5PdXRwdXQ6IGJvb2xlYW5cbiAgICAgIHNob3dUeXBlczogYm9vbGVhblxuICAgICAgY2hlY2tPblNhdmU6IGJvb2xlYW5cbiAgICAgIGdoY2lXcmFwcGVyUGF0aDogc3RyaW5nXG4gICAgfVxuICB9XG59XG4iXX0=