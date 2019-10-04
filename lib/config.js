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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFXLFFBQUEsTUFBTSxHQUFHO0lBQ2xCLFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxRQUFRO1FBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDO1FBQy9DLE9BQU8sRUFBRSxNQUFNO1FBQ2YsS0FBSyxFQUFFLENBQUM7S0FDVDtJQUNELFNBQVMsRUFBRTtRQUNULElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLE9BQU87UUFDaEIsV0FBVyxFQUFFLDBCQUEwQjtRQUN2QyxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsT0FBTztRQUNoQixXQUFXLEVBQUUsMEJBQTBCO1FBQ3ZDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxhQUFhLEVBQUU7UUFDYixJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLFdBQVcsRUFDVCxzRUFBc0U7UUFDeEUsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFFBQVEsRUFBRTtRQUNSLElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLE1BQU07UUFDZixXQUFXLEVBQUUseUJBQXlCO1FBQ3RDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxTQUFTLEVBQUU7UUFDVCxJQUFJLEVBQUUsT0FBTztRQUNiLE9BQU8sRUFBRSxFQUFFO1FBQ1gsV0FBVyxFQUFFLGlEQUFpRDtRQUM5RCxLQUFLLEVBQUU7WUFDTCxJQUFJLEVBQUUsUUFBUTtTQUNmO1FBQ0QsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUU7O3VEQUVzQztRQUNuRCxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsV0FBVyxFQUFFO1FBQ1gsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsR0FBRztRQUNaLE9BQU8sRUFBRSxDQUFDO1FBQ1YsV0FBVyxFQUFFLDJEQUEyRDtRQUN4RSxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLFNBQVM7UUFDZixPQUFPLEVBQUUsS0FBSztRQUNkLFdBQVcsRUFBRSwrQ0FBK0M7UUFDNUQsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUU7cUJBQ0k7UUFDakIsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELGVBQWUsRUFBRTtRQUNmLElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLEVBQUU7UUFDWCxXQUFXLEVBQUU7O29CQUVHO1FBQ2hCLEtBQUssRUFBRSxHQUFHO0tBQ1g7Q0FDRixDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGxldCBjb25maWcgPSB7XG4gIGRlZmF1bHRSZXBsOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZW51bTogWydzdGFjaycsICdjYWJhbC12MScsICdnaGNpJywgJ2NhYmFsLXYyJ10sXG4gICAgZGVmYXVsdDogJ2doY2knLFxuICAgIG9yZGVyOiAwLFxuICB9LFxuICBzdGFja1BhdGg6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBkZWZhdWx0OiAnc3RhY2snLFxuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBzdGFjayBleGVjdXRhYmxlJyxcbiAgICBvcmRlcjogMTAsXG4gIH0sXG4gIGNhYmFsUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICdjYWJhbCcsXG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIGNhYmFsIGV4ZWN1dGFibGUnLFxuICAgIG9yZGVyOiAyMCxcbiAgfSxcbiAgbGVnYWN5Q2FiYWxWMToge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiAnZmFsc2UnLFxuICAgIGRlc2NyaXB0aW9uOlxuICAgICAgJ0VuYWJsZSBpZiB1c2luZyBjYWJhbC1pbnN0YWxsIDwgMi40LjAuMCBhbmQgd2lzaCB0byB1c2UgYGNhYmFsIHJlcGxgJyxcbiAgICBvcmRlcjogMjEsXG4gIH0sXG4gIGdoY2lQYXRoOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZGVmYXVsdDogJ2doY2knLFxuICAgIGRlc2NyaXB0aW9uOiAnUGF0aCB0byBnaGNpIGV4ZWN1dGFibGUnLFxuICAgIG9yZGVyOiAzMCxcbiAgfSxcbiAgZXh0cmFBcmdzOiB7XG4gICAgdHlwZTogJ2FycmF5JyxcbiAgICBkZWZhdWx0OiBbXSxcbiAgICBkZXNjcmlwdGlvbjogJ0V4dHJhIGFyZ3VtZW50cyBwYXNzZWQgdG8gZ2hjaS4gQ29tbWEtc2VwYXJhdGVkJyxcbiAgICBpdGVtczoge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgfSxcbiAgICBvcmRlcjogNDAsXG4gIH0sXG4gIGF1dG9SZWxvYWRSZXBlYXQ6IHtcbiAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgZGVmYXVsdDogZmFsc2UsXG4gICAgZGVzY3JpcHRpb246IGBBdXRvbWF0aWNhbGx5IHJlbG9hZCBhbmQgcmVwZWF0IGxhc3QgY29tbWFuZCBvbiBmaWxlIHNhdmUuXG4gICAgVGhpcyBpcyBvbmx5IHRoZSBkZWZhdWx0LiBZb3UgY2FuIHRvZ2dsZSB0aGlzIHBlci1lZGl0b3IgdXNpbmdcbiAgICBpZGUtaGFza2VsbC1yZXBsOnRvZ2dsZS1hdXRvLXJlbG9hZC1yZXBlYXQgY29tbWFuZGAsXG4gICAgb3JkZXI6IDUwLFxuICB9LFxuICBtYXhNZXNzYWdlczoge1xuICAgIHR5cGU6ICdudW1iZXInLFxuICAgIGRlZmF1bHQ6IDEwMCxcbiAgICBtaW5pbXVtOiAwLFxuICAgIGRlc2NyaXB0aW9uOiBgTWF4aW11bSBudW1iZXIgb2YgZ2hjaSBtZXNzYWdlcyBzaG93bi4gMCBtZWFucyB1bmxpbWl0ZWQuYCxcbiAgICBvcmRlcjogNjAsXG4gIH0sXG4gIHNob3dUeXBlczoge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICBkZXNjcmlwdGlvbjogYFNob3cgdHlwZSB0b29sdGlwcyBpbiBpZGUtaGFza2VsbCBpZiBwb3NzaWJsZWAsXG4gICAgb3JkZXI6IDcwLFxuICB9LFxuICBjaGVja09uU2F2ZToge1xuICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICBkZXNjcmlwdGlvbjogYFJlbG9hZCBwcm9qZWN0IGluIGJhY2tncm91bmQgd2hlbiBmaWxlIGlzIHNhdmVkLCB3aWxsIGVmZmVjdGl2ZWx5XG4gICAgY2hlY2sgZm9yIGVycm9yc2AsXG4gICAgb3JkZXI6IDgwLFxuICB9LFxuICBnaGNpV3JhcHBlclBhdGg6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBkZWZhdWx0OiAnJyxcbiAgICBkZXNjcmlwdGlvbjogYFRoaXMgaXMgaW50ZW5kZWQgdG8gZml4IHRoZSAnaW50ZXJydXB0IGNsb3NlcyBnaGNpJyBwcm9ibGVtXG4gICAgb24gV2luZG93cyAtLSBzZWUgUkVBRE1FIGZvciBkZXRhaWxzLiBUaGlzIG9wdGlvbiBoYXMgbm8gZWZmZWN0IG9uXG4gICAgb3RoZXIgcGxhdGZvcm1zYCxcbiAgICBvcmRlcjogOTk5LFxuICB9LFxufVxuXG4vLyBnZW5lcmF0ZWQgYnkgdHlwZWQtY29uZmlnLmpzXG5kZWNsYXJlIG1vZHVsZSAnYXRvbScge1xuICBpbnRlcmZhY2UgQ29uZmlnVmFsdWVzIHtcbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5kZWZhdWx0UmVwbCc6ICdzdGFjaycgfCAnY2FiYWwtdjEnIHwgJ2doY2knIHwgJ2NhYmFsLXYyJ1xuICAgICdpZGUtaGFza2VsbC1yZXBsLnN0YWNrUGF0aCc6IHN0cmluZ1xuICAgICdpZGUtaGFza2VsbC1yZXBsLmNhYmFsUGF0aCc6IHN0cmluZ1xuICAgICdpZGUtaGFza2VsbC1yZXBsLmxlZ2FjeUNhYmFsVjEnOiBib29sZWFuXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVBhdGgnOiBzdHJpbmdcbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5leHRyYUFyZ3MnOiBzdHJpbmdbXVxuICAgICdpZGUtaGFza2VsbC1yZXBsLmF1dG9SZWxvYWRSZXBlYXQnOiBib29sZWFuXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwubWF4TWVzc2FnZXMnOiBudW1iZXJcbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5zaG93VHlwZXMnOiBib29sZWFuXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuY2hlY2tPblNhdmUnOiBib29sZWFuXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVdyYXBwZXJQYXRoJzogc3RyaW5nXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwnOiB7XG4gICAgICBkZWZhdWx0UmVwbDogJ3N0YWNrJyB8ICdjYWJhbC12MScgfCAnZ2hjaScgfCAnY2FiYWwtdjInXG4gICAgICBzdGFja1BhdGg6IHN0cmluZ1xuICAgICAgY2FiYWxQYXRoOiBzdHJpbmdcbiAgICAgIGxlZ2FjeUNhYmFsVjE6IGJvb2xlYW5cbiAgICAgIGdoY2lQYXRoOiBzdHJpbmdcbiAgICAgIGV4dHJhQXJnczogc3RyaW5nW11cbiAgICAgIGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgICAgIG1heE1lc3NhZ2VzOiBudW1iZXJcbiAgICAgIHNob3dUeXBlczogYm9vbGVhblxuICAgICAgY2hlY2tPblNhdmU6IGJvb2xlYW5cbiAgICAgIGdoY2lXcmFwcGVyUGF0aDogc3RyaW5nXG4gICAgfVxuICB9XG59XG4iXX0=