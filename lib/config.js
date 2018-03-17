"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = {
    defaultRepl: {
        type: 'string',
        enum: ['stack', 'cabal', 'ghci', 'cabal-new'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFXLFFBQUEsTUFBTSxHQUFHO0lBQ2xCLFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxRQUFRO1FBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxDQUFDO1FBQzdDLE9BQU8sRUFBRSxNQUFNO1FBQ2YsS0FBSyxFQUFFLENBQUM7S0FDVDtJQUNELFNBQVMsRUFBRTtRQUNULElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLE9BQU87UUFDaEIsV0FBVyxFQUFFLDBCQUEwQjtRQUN2QyxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsT0FBTztRQUNoQixXQUFXLEVBQUUsMEJBQTBCO1FBQ3ZDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxRQUFRLEVBQUU7UUFDUixJQUFJLEVBQUUsUUFBUTtRQUNkLE9BQU8sRUFBRSxNQUFNO1FBQ2YsV0FBVyxFQUFFLHlCQUF5QjtRQUN0QyxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLE9BQU87UUFDYixPQUFPLEVBQUUsRUFBRTtRQUNYLFdBQVcsRUFBRSxpREFBaUQ7UUFDOUQsS0FBSyxFQUFFO1lBQ0wsSUFBSSxFQUFFLFFBQVE7U0FDZjtRQUNELEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxnQkFBZ0IsRUFBRTtRQUNoQixJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxLQUFLO1FBQ2QsV0FBVyxFQUFFOzt1REFFc0M7UUFDbkQsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLEdBQUc7UUFDWixPQUFPLEVBQUUsQ0FBQztRQUNWLFdBQVcsRUFBRSwyREFBMkQ7UUFDeEUsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFNBQVMsRUFBRTtRQUNULElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUUsK0NBQStDO1FBQzVELEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxXQUFXLEVBQUU7UUFDWCxJQUFJLEVBQUUsU0FBUztRQUNmLE9BQU8sRUFBRSxLQUFLO1FBQ2QsV0FBVyxFQUFFO3FCQUNJO1FBQ2pCLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxlQUFlLEVBQUU7UUFDZixJQUFJLEVBQUUsUUFBUTtRQUNkLE9BQU8sRUFBRSxFQUFFO1FBQ1gsV0FBVyxFQUFFOztvQkFFRztRQUNoQixLQUFLLEVBQUUsR0FBRztLQUNYO0NBQ0YsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBsZXQgY29uZmlnID0ge1xuICBkZWZhdWx0UmVwbDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGVudW06IFsnc3RhY2snLCAnY2FiYWwnLCAnZ2hjaScsICdjYWJhbC1uZXcnXSxcbiAgICBkZWZhdWx0OiAnZ2hjaScsXG4gICAgb3JkZXI6IDAsXG4gIH0sXG4gIHN0YWNrUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICdzdGFjaycsXG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIHN0YWNrIGV4ZWN1dGFibGUnLFxuICAgIG9yZGVyOiAxMCxcbiAgfSxcbiAgY2FiYWxQYXRoOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZGVmYXVsdDogJ2NhYmFsJyxcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gY2FiYWwgZXhlY3V0YWJsZScsXG4gICAgb3JkZXI6IDIwLFxuICB9LFxuICBnaGNpUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICdnaGNpJyxcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gZ2hjaSBleGVjdXRhYmxlJyxcbiAgICBvcmRlcjogMzAsXG4gIH0sXG4gIGV4dHJhQXJnczoge1xuICAgIHR5cGU6ICdhcnJheScsXG4gICAgZGVmYXVsdDogW10sXG4gICAgZGVzY3JpcHRpb246ICdFeHRyYSBhcmd1bWVudHMgcGFzc2VkIHRvIGdoY2kuIENvbW1hLXNlcGFyYXRlZCcsXG4gICAgaXRlbXM6IHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIH0sXG4gICAgb3JkZXI6IDQwLFxuICB9LFxuICBhdXRvUmVsb2FkUmVwZWF0OiB7XG4gICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgIGRlc2NyaXB0aW9uOiBgQXV0b21hdGljYWxseSByZWxvYWQgYW5kIHJlcGVhdCBsYXN0IGNvbW1hbmQgb24gZmlsZSBzYXZlLlxuICAgIFRoaXMgaXMgb25seSB0aGUgZGVmYXVsdC4gWW91IGNhbiB0b2dnbGUgdGhpcyBwZXItZWRpdG9yIHVzaW5nXG4gICAgaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0IGNvbW1hbmRgLFxuICAgIG9yZGVyOiA1MCxcbiAgfSxcbiAgbWF4TWVzc2FnZXM6IHtcbiAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICBkZWZhdWx0OiAxMDAsXG4gICAgbWluaW11bTogMCxcbiAgICBkZXNjcmlwdGlvbjogYE1heGltdW0gbnVtYmVyIG9mIGdoY2kgbWVzc2FnZXMgc2hvd24uIDAgbWVhbnMgdW5saW1pdGVkLmAsXG4gICAgb3JkZXI6IDYwLFxuICB9LFxuICBzaG93VHlwZXM6IHtcbiAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgZGVmYXVsdDogZmFsc2UsXG4gICAgZGVzY3JpcHRpb246IGBTaG93IHR5cGUgdG9vbHRpcHMgaW4gaWRlLWhhc2tlbGwgaWYgcG9zc2libGVgLFxuICAgIG9yZGVyOiA3MCxcbiAgfSxcbiAgY2hlY2tPblNhdmU6IHtcbiAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgZGVmYXVsdDogZmFsc2UsXG4gICAgZGVzY3JpcHRpb246IGBSZWxvYWQgcHJvamVjdCBpbiBiYWNrZ3JvdW5kIHdoZW4gZmlsZSBpcyBzYXZlZCwgd2lsbCBlZmZlY3RpdmVseVxuICAgIGNoZWNrIGZvciBlcnJvcnNgLFxuICAgIG9yZGVyOiA4MCxcbiAgfSxcbiAgZ2hjaVdyYXBwZXJQYXRoOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZGVmYXVsdDogJycsXG4gICAgZGVzY3JpcHRpb246IGBUaGlzIGlzIGludGVuZGVkIHRvIGZpeCB0aGUgJ2ludGVycnVwdCBjbG9zZXMgZ2hjaScgcHJvYmxlbVxuICAgIG9uIFdpbmRvd3MgLS0gc2VlIFJFQURNRSBmb3IgZGV0YWlscy4gVGhpcyBvcHRpb24gaGFzIG5vIGVmZmVjdCBvblxuICAgIG90aGVyIHBsYXRmb3Jtc2AsXG4gICAgb3JkZXI6IDk5OSxcbiAgfSxcbn1cblxuLy8gZ2VuZXJhdGVkIGJ5IHR5cGVkLWNvbmZpZy5qc1xuZGVjbGFyZSBtb2R1bGUgJ2F0b20nIHtcbiAgaW50ZXJmYWNlIENvbmZpZ1ZhbHVlcyB7XG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuZGVmYXVsdFJlcGwnOiAnc3RhY2snIHwgJ2NhYmFsJyB8ICdnaGNpJ1xuICAgICdpZGUtaGFza2VsbC1yZXBsLnN0YWNrUGF0aCc6IHN0cmluZ1xuICAgICdpZGUtaGFza2VsbC1yZXBsLmNhYmFsUGF0aCc6IHN0cmluZ1xuICAgICdpZGUtaGFza2VsbC1yZXBsLmdoY2lQYXRoJzogc3RyaW5nXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuZXh0cmFBcmdzJzogc3RyaW5nW11cbiAgICAnaWRlLWhhc2tlbGwtcmVwbC5hdXRvUmVsb2FkUmVwZWF0JzogYm9vbGVhblxuICAgICdpZGUtaGFza2VsbC1yZXBsLm1heE1lc3NhZ2VzJzogbnVtYmVyXG4gICAgJ2lkZS1oYXNrZWxsLXJlcGwuc2hvd1R5cGVzJzogYm9vbGVhblxuICAgICdpZGUtaGFza2VsbC1yZXBsLmNoZWNrT25TYXZlJzogYm9vbGVhblxuICAgICdpZGUtaGFza2VsbC1yZXBsLmdoY2lXcmFwcGVyUGF0aCc6IHN0cmluZ1xuICAgICdpZGUtaGFza2VsbC1yZXBsJzoge1xuICAgICAgZGVmYXVsdFJlcGw6ICdzdGFjaycgfCAnY2FiYWwnIHwgJ2doY2knXG4gICAgICBzdGFja1BhdGg6IHN0cmluZ1xuICAgICAgY2FiYWxQYXRoOiBzdHJpbmdcbiAgICAgIGdoY2lQYXRoOiBzdHJpbmdcbiAgICAgIGV4dHJhQXJnczogc3RyaW5nW11cbiAgICAgIGF1dG9SZWxvYWRSZXBlYXQ6IGJvb2xlYW5cbiAgICAgIG1heE1lc3NhZ2VzOiBudW1iZXJcbiAgICAgIHNob3dUeXBlczogYm9vbGVhblxuICAgICAgY2hlY2tPblNhdmU6IGJvb2xlYW5cbiAgICAgIGdoY2lXcmFwcGVyUGF0aDogc3RyaW5nXG4gICAgfVxuICB9XG59XG4iXX0=