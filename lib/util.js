"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function handlePromise(somePromise) {
    somePromise.catch((e) => {
        atom.notifications.addFatalError(e.name, {
            detail: e.message,
            stack: e.stack,
        });
    });
}
exports.handlePromise = handlePromise;
function getText(m) {
    if (typeof m === 'string') {
        return m;
    }
    else {
        if ('text' in m)
            return m.text;
        else
            return m.html;
    }
}
exports.getText = getText;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUEsU0FBZ0IsYUFBYSxDQUFDLFdBQXlCO0lBQ3JELFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFRLEVBQUUsRUFBRTtRQUM3QixJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFO1lBQ3ZDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTztZQUNqQixLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUs7U0FDZixDQUFDLENBQUE7SUFDSixDQUFDLENBQUMsQ0FBQTtBQUNKLENBQUM7QUFQRCxzQ0FPQztBQUVELFNBQWdCLE9BQU8sQ0FBQyxDQUFlO0lBQ3JDLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO1FBQ3pCLE9BQU8sQ0FBQyxDQUFBO0tBQ1Q7U0FBTTtRQUNMLElBQUksTUFBTSxJQUFJLENBQUM7WUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUE7O1lBQ3pCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQTtLQUNuQjtBQUNILENBQUM7QUFQRCwwQkFPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIFVQSSBmcm9tICdhdG9tLWhhc2tlbGwtdXBpJ1xuXG5leHBvcnQgZnVuY3Rpb24gaGFuZGxlUHJvbWlzZShzb21lUHJvbWlzZTogUHJvbWlzZTxhbnk+KTogdm9pZCB7XG4gIHNvbWVQcm9taXNlLmNhdGNoKChlOiBFcnJvcikgPT4ge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKGUubmFtZSwge1xuICAgICAgZGV0YWlsOiBlLm1lc3NhZ2UsXG4gICAgICBzdGFjazogZS5zdGFjayxcbiAgICB9KVxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGV4dChtOiBVUEkuVE1lc3NhZ2UpOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIG0gPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIG1cbiAgfSBlbHNlIHtcbiAgICBpZiAoJ3RleHQnIGluIG0pIHJldHVybiBtLnRleHRcbiAgICBlbHNlIHJldHVybiBtLmh0bWxcbiAgfVxufVxuIl19