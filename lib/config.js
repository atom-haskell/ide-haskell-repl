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
    ghciWrapperPath: {
        type: 'string',
        default: '',
        description: `This is intended to fix the 'interrupt closes ghci' problem
    on Windows -- see README for details. This option has no effect on
    other platforms`,
        order: 999,
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFXLFFBQUEsTUFBTSxHQUFHO0lBQ2xCLFdBQVcsRUFBRTtRQUNYLElBQUksRUFBRSxRQUFRO1FBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7UUFDaEMsT0FBTyxFQUFFLE1BQU07UUFDZixLQUFLLEVBQUUsQ0FBQztLQUNUO0lBQ0QsU0FBUyxFQUFFO1FBQ1QsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsT0FBTztRQUNoQixXQUFXLEVBQUUsMEJBQTBCO1FBQ3ZDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxTQUFTLEVBQUU7UUFDVCxJQUFJLEVBQUUsUUFBUTtRQUNkLE9BQU8sRUFBRSxPQUFPO1FBQ2hCLFdBQVcsRUFBRSwwQkFBMEI7UUFDdkMsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELFFBQVEsRUFBRTtRQUNSLElBQUksRUFBRSxRQUFRO1FBQ2QsT0FBTyxFQUFFLE1BQU07UUFDZixXQUFXLEVBQUUseUJBQXlCO1FBQ3RDLEtBQUssRUFBRSxFQUFFO0tBQ1Y7SUFDRCxTQUFTLEVBQUU7UUFDVCxJQUFJLEVBQUUsT0FBTztRQUNiLE9BQU8sRUFBRSxFQUFFO1FBQ1gsV0FBVyxFQUFFLGlEQUFpRDtRQUM5RCxLQUFLLEVBQUU7WUFDTCxJQUFJLEVBQUUsUUFBUTtTQUNmO1FBQ0QsS0FBSyxFQUFFLEVBQUU7S0FDVjtJQUNELGdCQUFnQixFQUFFO1FBQ2hCLElBQUksRUFBRSxTQUFTO1FBQ2YsT0FBTyxFQUFFLEtBQUs7UUFDZCxXQUFXLEVBQUU7O3VEQUVzQztRQUNuRCxLQUFLLEVBQUUsRUFBRTtLQUNWO0lBQ0QsZUFBZSxFQUFFO1FBQ2YsSUFBSSxFQUFFLFFBQVE7UUFDZCxPQUFPLEVBQUUsRUFBRTtRQUNYLFdBQVcsRUFBRTs7b0JBRUc7UUFDaEIsS0FBSyxFQUFFLEdBQUc7S0FDWDtDQUNGLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgbGV0IGNvbmZpZyA9IHtcbiAgZGVmYXVsdFJlcGw6IHtcbiAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICBlbnVtOiBbJ3N0YWNrJywgJ2NhYmFsJywgJ2doY2knXSxcbiAgICBkZWZhdWx0OiAnZ2hjaScsXG4gICAgb3JkZXI6IDAsXG4gIH0sXG4gIHN0YWNrUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICdzdGFjaycsXG4gICAgZGVzY3JpcHRpb246ICdQYXRoIHRvIHN0YWNrIGV4ZWN1dGFibGUnLFxuICAgIG9yZGVyOiAxMCxcbiAgfSxcbiAgY2FiYWxQYXRoOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZGVmYXVsdDogJ2NhYmFsJyxcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gY2FiYWwgZXhlY3V0YWJsZScsXG4gICAgb3JkZXI6IDIwLFxuICB9LFxuICBnaGNpUGF0aDoge1xuICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIGRlZmF1bHQ6ICdnaGNpJyxcbiAgICBkZXNjcmlwdGlvbjogJ1BhdGggdG8gZ2hjaSBleGVjdXRhYmxlJyxcbiAgICBvcmRlcjogMzAsXG4gIH0sXG4gIGV4dHJhQXJnczoge1xuICAgIHR5cGU6ICdhcnJheScsXG4gICAgZGVmYXVsdDogW10sXG4gICAgZGVzY3JpcHRpb246ICdFeHRyYSBhcmd1bWVudHMgcGFzc2VkIHRvIGdoY2kuIENvbW1hLXNlcGFyYXRlZCcsXG4gICAgaXRlbXM6IHtcbiAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgIH0sXG4gICAgb3JkZXI6IDQwLFxuICB9LFxuICBhdXRvUmVsb2FkUmVwZWF0OiB7XG4gICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgIGRlZmF1bHQ6IGZhbHNlLFxuICAgIGRlc2NyaXB0aW9uOiBgQXV0b21hdGljYWxseSByZWxvYWQgYW5kIHJlcGVhdCBsYXN0IGNvbW1hbmQgb24gZmlsZSBzYXZlLlxuICAgIFRoaXMgaXMgb25seSB0aGUgZGVmYXVsdC4gWW91IGNhbiB0b2dnbGUgdGhpcyBwZXItZWRpdG9yIHVzaW5nXG4gICAgaWRlLWhhc2tlbGwtcmVwbDp0b2dnbGUtYXV0by1yZWxvYWQtcmVwZWF0IGNvbW1hbmRgLFxuICAgIG9yZGVyOiA1MCxcbiAgfSxcbiAgZ2hjaVdyYXBwZXJQYXRoOiB7XG4gICAgdHlwZTogJ3N0cmluZycsXG4gICAgZGVmYXVsdDogJycsXG4gICAgZGVzY3JpcHRpb246IGBUaGlzIGlzIGludGVuZGVkIHRvIGZpeCB0aGUgJ2ludGVycnVwdCBjbG9zZXMgZ2hjaScgcHJvYmxlbVxuICAgIG9uIFdpbmRvd3MgLS0gc2VlIFJFQURNRSBmb3IgZGV0YWlscy4gVGhpcyBvcHRpb24gaGFzIG5vIGVmZmVjdCBvblxuICAgIG90aGVyIHBsYXRmb3Jtc2AsXG4gICAgb3JkZXI6IDk5OSxcbiAgfSxcbn1cbiJdfQ==