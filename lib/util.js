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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy91dGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsU0FBZ0IsYUFBYSxDQUFDLFdBQXlCO0lBQ3JELFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFRLEVBQUUsRUFBRTtRQUM3QixJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFO1lBQ3ZDLE1BQU0sRUFBRSxDQUFDLENBQUMsT0FBTztZQUNqQixLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUs7U0FDZixDQUFDLENBQUE7SUFDSixDQUFDLENBQUMsQ0FBQTtBQUNKLENBQUM7QUFQRCxzQ0FPQyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBoYW5kbGVQcm9taXNlKHNvbWVQcm9taXNlOiBQcm9taXNlPGFueT4pOiB2b2lkIHtcbiAgc29tZVByb21pc2UuY2F0Y2goKGU6IEVycm9yKSA9PiB7XG4gICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZEZhdGFsRXJyb3IoZS5uYW1lLCB7XG4gICAgICBkZXRhaWw6IGUubWVzc2FnZSxcbiAgICAgIHN0YWNrOiBlLnN0YWNrLFxuICAgIH0pXG4gIH0pXG59XG4iXX0=