"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const atom_1 = require("atom");
async function setupGhciWrapper() {
    const downloadUrl = 'https://github.com/atom-haskell/win-ghci-wrapper/releases/download/v0.0.2/ghci-wrapper.exe';
    const expectedDigest = '4663295d71a5057dee41945a52d39ed61fcd8830';
    try {
        atom.notifications.addInfo('GHCi Wrapper setup started...');
        const buf = await downloadFile(downloadUrl);
        checkHash(buf, expectedDigest);
        const filePath = await writeFile(buf);
        atom.config.set('ide-haskell-repl.ghciWrapperPath', filePath);
        atom.notifications.addSuccess('GHCi Wrapper setup finished!');
    }
    catch (e) {
        if (e !== null) {
            atom.notifications.addFatalError('GHCi wrapper setup failed', {
                stack: e.stack,
                detail: e.message,
                dismissable: true,
            });
        }
    }
}
exports.setupGhciWrapper = setupGhciWrapper;
async function downloadFile(url) {
    const result = await window.fetch(url, {
        redirect: 'follow',
    });
    if (!result.ok) {
        atom.notifications.addError('Getting ghci-wrapper.exe failed', {
            detail: result.statusText,
            dismissable: true,
        });
        throw null;
    }
    return Buffer.from(await result.arrayBuffer());
}
function checkHash(buf, expected) {
    const hash = crypto_1.createHash('sha1');
    hash.update(buf);
    const digest = hash.digest('hex');
    if (digest !== expected) {
        atom.notifications.addError('Got ghci-wrapper.exe, but hash check failed!', {
            detail: `Expected ${expected} but got ${digest}`,
            dismissable: true,
        });
        throw null;
    }
}
async function writeFile(buf) {
    const configDir = new atom_1.Directory(atom.getConfigDirPath());
    const subdir = configDir.getSubdirectory('ide-haskell-repl');
    if (!(await subdir.exists())) {
        if (!(await subdir.create())) {
            atom.notifications.addError('Failed to create directory for ghci-wrapper', {
                detail: subdir.getPath(),
                dismissable: true,
            });
            throw null;
        }
    }
    const file = subdir.getFile('ghci-wrapper.exe');
    const stream = file.createWriteStream();
    try {
        await new Promise((resolve, reject) => {
            stream.on('error', reject);
            stream.write(buf, (error) => {
                stream.off('error', reject);
                if (error != null)
                    reject(error);
                else
                    resolve();
            });
        });
    }
    finally {
        stream.close();
    }
    return file.getPath();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dXAtZ2hjaS13cmFwcGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3NldHVwLWdoY2ktd3JhcHBlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLG1DQUFtQztBQUNuQywrQkFBZ0M7QUFFekIsS0FBSyxVQUFVLGdCQUFnQjtJQUNwQyxNQUFNLFdBQVcsR0FDZiw0RkFBNEYsQ0FBQTtJQUM5RixNQUFNLGNBQWMsR0FBRywwQ0FBMEMsQ0FBQTtJQUNqRSxJQUFJO1FBQ0YsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsK0JBQStCLENBQUMsQ0FBQTtRQUMzRCxNQUFNLEdBQUcsR0FBRyxNQUFNLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQTtRQUMzQyxTQUFTLENBQUMsR0FBRyxFQUFFLGNBQWMsQ0FBQyxDQUFBO1FBQzlCLE1BQU0sUUFBUSxHQUFHLE1BQU0sU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFBO1FBQ3JDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxFQUFFLFFBQVEsQ0FBQyxDQUFBO1FBQzdELElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLDhCQUE4QixDQUFDLENBQUE7S0FDOUQ7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLElBQUksQ0FBQyxLQUFLLElBQUksRUFBRTtZQUNkLElBQUksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLDJCQUEyQixFQUFFO2dCQUM1RCxLQUFLLEVBQUUsQ0FBQyxDQUFDLEtBQUs7Z0JBQ2QsTUFBTSxFQUFFLENBQUMsQ0FBQyxPQUFPO2dCQUNqQixXQUFXLEVBQUUsSUFBSTthQUNsQixDQUFDLENBQUE7U0FDSDtLQUNGO0FBQ0gsQ0FBQztBQXBCRCw0Q0FvQkM7QUFFRCxLQUFLLFVBQVUsWUFBWSxDQUFDLEdBQVc7SUFDckMsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRTtRQUNyQyxRQUFRLEVBQUUsUUFBUTtLQUNuQixDQUFDLENBQUE7SUFDRixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRTtRQUNkLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLGlDQUFpQyxFQUFFO1lBQzdELE1BQU0sRUFBRSxNQUFNLENBQUMsVUFBVTtZQUN6QixXQUFXLEVBQUUsSUFBSTtTQUNsQixDQUFDLENBQUE7UUFDRixNQUFNLElBQUksQ0FBQTtLQUNYO0lBQ0QsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUE7QUFDaEQsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLEdBQVcsRUFBRSxRQUFnQjtJQUM5QyxNQUFNLElBQUksR0FBRyxtQkFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFBO0lBQy9CLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDaEIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUNqQyxJQUFJLE1BQU0sS0FBSyxRQUFRLEVBQUU7UUFDdkIsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQ3pCLDhDQUE4QyxFQUM5QztZQUNFLE1BQU0sRUFBRSxZQUFZLFFBQVEsWUFBWSxNQUFNLEVBQUU7WUFDaEQsV0FBVyxFQUFFLElBQUk7U0FDbEIsQ0FDRixDQUFBO1FBQ0QsTUFBTSxJQUFJLENBQUE7S0FDWDtBQUNILENBQUM7QUFFRCxLQUFLLFVBQVUsU0FBUyxDQUFDLEdBQVc7SUFDbEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxnQkFBUyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLENBQUE7SUFDeEQsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO0lBQzVELElBQUksQ0FBQyxDQUFDLE1BQU0sTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7UUFDNUIsSUFBSSxDQUFDLENBQUMsTUFBTSxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRTtZQUM1QixJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FDekIsNkNBQTZDLEVBQzdDO2dCQUNFLE1BQU0sRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFO2dCQUN4QixXQUFXLEVBQUUsSUFBSTthQUNsQixDQUNGLENBQUE7WUFDRCxNQUFNLElBQUksQ0FBQTtTQUNYO0tBQ0Y7SUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUE7SUFDL0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUE7SUFDdkMsSUFBSTtRQUNGLE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDMUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUE7WUFDMUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDMUIsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUE7Z0JBQzNCLElBQUksS0FBSyxJQUFJLElBQUk7b0JBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFBOztvQkFDM0IsT0FBTyxFQUFFLENBQUE7WUFDaEIsQ0FBQyxDQUFDLENBQUE7UUFDSixDQUFDLENBQUMsQ0FBQTtLQUNIO1lBQVM7UUFDUixNQUFNLENBQUMsS0FBSyxFQUFFLENBQUE7S0FDZjtJQUNELE9BQU8sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO0FBQ3ZCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IHsgRGlyZWN0b3J5IH0gZnJvbSAnYXRvbSdcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNldHVwR2hjaVdyYXBwZXIoKSB7XG4gIGNvbnN0IGRvd25sb2FkVXJsID1cbiAgICAnaHR0cHM6Ly9naXRodWIuY29tL2F0b20taGFza2VsbC93aW4tZ2hjaS13cmFwcGVyL3JlbGVhc2VzL2Rvd25sb2FkL3YwLjAuMi9naGNpLXdyYXBwZXIuZXhlJ1xuICBjb25zdCBleHBlY3RlZERpZ2VzdCA9ICc0NjYzMjk1ZDcxYTUwNTdkZWU0MTk0NWE1MmQzOWVkNjFmY2Q4ODMwJ1xuICB0cnkge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRJbmZvKCdHSENpIFdyYXBwZXIgc2V0dXAgc3RhcnRlZC4uLicpXG4gICAgY29uc3QgYnVmID0gYXdhaXQgZG93bmxvYWRGaWxlKGRvd25sb2FkVXJsKVxuICAgIGNoZWNrSGFzaChidWYsIGV4cGVjdGVkRGlnZXN0KVxuICAgIGNvbnN0IGZpbGVQYXRoID0gYXdhaXQgd3JpdGVGaWxlKGJ1ZilcbiAgICBhdG9tLmNvbmZpZy5zZXQoJ2lkZS1oYXNrZWxsLXJlcGwuZ2hjaVdyYXBwZXJQYXRoJywgZmlsZVBhdGgpXG4gICAgYXRvbS5ub3RpZmljYXRpb25zLmFkZFN1Y2Nlc3MoJ0dIQ2kgV3JhcHBlciBzZXR1cCBmaW5pc2hlZCEnKVxuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUgIT09IG51bGwpIHtcbiAgICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRGYXRhbEVycm9yKCdHSENpIHdyYXBwZXIgc2V0dXAgZmFpbGVkJywge1xuICAgICAgICBzdGFjazogZS5zdGFjayxcbiAgICAgICAgZGV0YWlsOiBlLm1lc3NhZ2UsXG4gICAgICAgIGRpc21pc3NhYmxlOiB0cnVlLFxuICAgICAgfSlcbiAgICB9XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZG93bmxvYWRGaWxlKHVybDogc3RyaW5nKTogUHJvbWlzZTxCdWZmZXI+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgd2luZG93LmZldGNoKHVybCwge1xuICAgIHJlZGlyZWN0OiAnZm9sbG93JyxcbiAgfSlcbiAgaWYgKCFyZXN1bHQub2spIHtcbiAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoJ0dldHRpbmcgZ2hjaS13cmFwcGVyLmV4ZSBmYWlsZWQnLCB7XG4gICAgICBkZXRhaWw6IHJlc3VsdC5zdGF0dXNUZXh0LFxuICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgfSlcbiAgICB0aHJvdyBudWxsXG4gIH1cbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKGF3YWl0IHJlc3VsdC5hcnJheUJ1ZmZlcigpKVxufVxuXG5mdW5jdGlvbiBjaGVja0hhc2goYnVmOiBCdWZmZXIsIGV4cGVjdGVkOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goJ3NoYTEnKVxuICBoYXNoLnVwZGF0ZShidWYpXG4gIGNvbnN0IGRpZ2VzdCA9IGhhc2guZGlnZXN0KCdoZXgnKVxuICBpZiAoZGlnZXN0ICE9PSBleHBlY3RlZCkge1xuICAgIGF0b20ubm90aWZpY2F0aW9ucy5hZGRFcnJvcihcbiAgICAgICdHb3QgZ2hjaS13cmFwcGVyLmV4ZSwgYnV0IGhhc2ggY2hlY2sgZmFpbGVkIScsXG4gICAgICB7XG4gICAgICAgIGRldGFpbDogYEV4cGVjdGVkICR7ZXhwZWN0ZWR9IGJ1dCBnb3QgJHtkaWdlc3R9YCxcbiAgICAgICAgZGlzbWlzc2FibGU6IHRydWUsXG4gICAgICB9LFxuICAgIClcbiAgICB0aHJvdyBudWxsXG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gd3JpdGVGaWxlKGJ1ZjogQnVmZmVyKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgY29uZmlnRGlyID0gbmV3IERpcmVjdG9yeShhdG9tLmdldENvbmZpZ0RpclBhdGgoKSlcbiAgY29uc3Qgc3ViZGlyID0gY29uZmlnRGlyLmdldFN1YmRpcmVjdG9yeSgnaWRlLWhhc2tlbGwtcmVwbCcpXG4gIGlmICghKGF3YWl0IHN1YmRpci5leGlzdHMoKSkpIHtcbiAgICBpZiAoIShhd2FpdCBzdWJkaXIuY3JlYXRlKCkpKSB7XG4gICAgICBhdG9tLm5vdGlmaWNhdGlvbnMuYWRkRXJyb3IoXG4gICAgICAgICdGYWlsZWQgdG8gY3JlYXRlIGRpcmVjdG9yeSBmb3IgZ2hjaS13cmFwcGVyJyxcbiAgICAgICAge1xuICAgICAgICAgIGRldGFpbDogc3ViZGlyLmdldFBhdGgoKSxcbiAgICAgICAgICBkaXNtaXNzYWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIClcbiAgICAgIHRocm93IG51bGxcbiAgICB9XG4gIH1cbiAgY29uc3QgZmlsZSA9IHN1YmRpci5nZXRGaWxlKCdnaGNpLXdyYXBwZXIuZXhlJylcbiAgY29uc3Qgc3RyZWFtID0gZmlsZS5jcmVhdGVXcml0ZVN0cmVhbSgpXG4gIHRyeSB7XG4gICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgc3RyZWFtLm9uKCdlcnJvcicsIHJlamVjdClcbiAgICAgIHN0cmVhbS53cml0ZShidWYsIChlcnJvcikgPT4ge1xuICAgICAgICBzdHJlYW0ub2ZmKCdlcnJvcicsIHJlamVjdClcbiAgICAgICAgaWYgKGVycm9yICE9IG51bGwpIHJlamVjdChlcnJvcilcbiAgICAgICAgZWxzZSByZXNvbHZlKClcbiAgICAgIH0pXG4gICAgfSlcbiAgfSBmaW5hbGx5IHtcbiAgICBzdHJlYW0uY2xvc2UoKVxuICB9XG4gIHJldHVybiBmaWxlLmdldFBhdGgoKVxufVxuIl19