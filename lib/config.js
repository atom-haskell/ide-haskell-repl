"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = {
    defaultRepl: {
        type: 'string',
        enum: ['stack', 'cabal', 'ghci'],
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
    showTypes: {
        type: 'boolean',
        default: true,
        description: `Show type tooltips in ide-haskell if possible`,
        order: 60,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFXLFFBQUEsTUFBTSxHQUFHO0lBQ2xCLFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxRQUFRO1FBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7UUFDaEMsT0FBTyxFQUFFLE1BQU07UUFDZixLQUFLLEVBQUUsQ0FBQztLQUNUO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsT0FBTztRQUNoQixXQUFXLEVBQUUsMEJBQTBCO1FBQ3ZDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxTQUFTLEVBQUU7UUFDVCxJQUFJLEVBQUUsUUFBUTtRQUNkLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLFdBQVcsRUFBRSwwQkFBMEI7UUFDdkMsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFFBQVEsRUFBRTtRQUNSLElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLE1BQU07UUFDZixXQUFXLEVBQUUseUJBQXlCO1FBQ3RDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxTQUFTLEVBQUU7UUFDVCxJQUFJLEVBQUUsT0FBTztRQUNiLE9BQU8sRUFBRSxFQUFFO1FBQ1gsV0FBVyxFQUFFLGlEQUFpRDtRQUM5RCxLQUFLLEVBQUU7WUFDTCxJQUFJLEVBQUUsUUFBUTtTQUNmO1FBQ0QsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUU7O3VEQUVzQztRQUNuRCxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLFNBQVM7UUFDZixPQUFPLEVBQUUsSUFBSTtRQUNiLFdBQVcsRUFBRSwrQ0FBK0M7UUFDNUQsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELGVBQWUsRUFBRTtRQUNmLElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLEVBQUU7UUFDWCxXQUFXLEVBQUU7O29CQUVHO1FBQ2hCLEtBQUssRUFBRSxHQUFHO0tBQ1g7Q0FDRixDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGxldCBjb25maWcgPSB7XG4gIGRlZmF1bHRSZXBsOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZW51bTogWydzdGFjaycsICdjYWJhbCcsICdnaGNpJ10sXG4gICAgZGVmYXVsdDogJ2doY2knLFxuICAgIG9yZGVyOiAwLFxuICB9LFxuICBzdGFja1BhdGg6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBkZWZhdWx0OiAnc3RhY2snLFxuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBzdGFjayBleGVjdXRhYmxlJyxcbiAgICBvcmRlcjogMTAsXG4gIH0sXG4gIGNhYmFsUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICdjYWJhbCcsXG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGNhYmFsIGV4ZWN1dGFibGUnLFxuICAgIG9yZGVyOiAyMCxcbiAgfSxcbiAgZ2hjaVBhdGg6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBkZWZhdWx0OiAnZ2hjaScsXG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGdoY2kgZXhlY3V0YWJsZScsXG4gICAgb3JkZXI6IDMwLFxuICB9LFxuICBleHRyYUFyZ3M6IHtcbiAgICB0eXBlOiAnYXJyYXknLFxuICAgIGRlZmF1bHQ6IFtdLFxuICAgIGRlc2NyaXB0aW9uOiAnRXh0cmEgYXJndW1lbnRzIHBhc3NlZCB0byBnaGNpLiBDb21tYS1zZXBhcmF0ZWQnLFxuICAgIGl0ZW1zOiB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICB9LFxuICAgIG9yZGVyOiA0MCxcbiAgfSxcbiAgYXV0b1JlbG9hZFJlcGVhdDoge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICBkZXNjcmlwdGlvbjogYEF1dG9tYXRpY2FsbHkgcmVsb2FkIGFuZCByZXBlYXQgbGFzdCBjb21tYW5kIG9uIGZpbGUgc2F2ZS5cbiAgICBUaGlzIGlzIG9ubHkgdGhlIGRlZmF1bHQuIFlvdSBjYW4gdG9nZ2xlIHRoaXMgcGVyLWVkaXRvciB1c2luZ1xuICAgIGlkZS1oYXNrZWxsLXJlcGw6dG9nZ2xlLWF1dG8tcmVsb2FkLXJlcGVhdCBjb21tYW5kYCxcbiAgICBvcmRlcjogNTAsXG4gIH0sXG4gIHNob3dUeXBlczoge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiB0cnVlLFxuICAgIGRlc2NyaXB0aW9uOiBgU2hvdyB0eXBlIHRvb2x0aXBzIGluIGlkZS1oYXNrZWxsIGlmIHBvc3NpYmxlYCxcbiAgICBvcmRlcjogNjAsXG4gIH0sXG4gIGdoY2lXcmFwcGVyUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICcnLFxuICAgIGRlc2NyaXB0aW9uOiBgVGhpcyBpcyBpbnRlbmRlZCB0byBmaXggdGhlICdpbnRlcnJ1cHQgY2xvc2VzIGdoY2knIHByb2JsZW1cbiAgICBvbiBXaW5kb3dzIC0tIHNlZSBSRUFETUUgZm9yIGRldGFpbHMuIFRoaXMgb3B0aW9uIGhhcyBubyBlZmZlY3Qgb25cbiAgICBvdGhlciBwbGF0Zm9ybXNgLFxuICAgIG9yZGVyOiA5OTksXG4gIH0sXG59XG4iXX0=