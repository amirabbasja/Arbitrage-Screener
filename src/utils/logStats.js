import { stringify } from "querystring";
import readline from "readline";

/**
 * Formats time in milliseconds to a human-readable string (seconds, minutes, or hours)
 * @param {number} ms - Time in milliseconds
 * @returns {string} - Formatted time string
 */
function formatTime(ms) {
    const seconds = ms / 1000;
    
    if (seconds < 60) {
        return `${seconds.toFixed(1)} seconds`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = (seconds % 60).toFixed(1);
        return `${minutes} m${minutes !== 1 ? 's' : ''} ${remainingSeconds} s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} h${hours !== 1 ? 's' : ''} ${minutes} m${minutes !== 1 ? 's' : ''}`;
    }
}

/**
 * Logs the stats of application in the console by making a request to 
 * "./stats" route in a loop with a specific delay.
 * 
 * @param {number} delay - The delay in ms
 */
async function logStats(delay){
    async function updateLog(appStartTime) {
        let text = ""

        // Clear previous output
        readline.cursorTo(process.stdout, 0, 0);
        readline.clearScreenDown(process.stdout);

        const appUptime = new Date() - appStartTime;
        text += `App is running for ${formatTime(appUptime)}\n`;
        const response = await fetch(`http://${process.env.app_host}:${process.env.app_port}/status`)
            .then(res => res.json())
    
        if (response){
            if (response.status === "success"){
                text += "Active Tasks\n--------------\n"
                const tasks = response.data.tasks
                if(tasks){
                    for (let i = 0; i < tasks.length; i++){
                        const taskUptime = new Date() - new Date(tasks[i].created_at)
                        text += `${i + 1} | Task id: ${tasks[i].id} - Uptime: ${formatTime(taskUptime)}\n`
                    }

                    text += "--------------\n"
                    text += "Request Queue details\n"
                    for (let j = 0; j < tasks.length; j++){
                        text += `Task id: ${tasks[j].id}\n`
                        let limiters = tasks[j].extra_info.limiterStats
                        if(limiters){
                            const names = Object.keys(limiters)
                            for (let k = 0; k < names.length; k++){
                                text += `   ${names[k]}\n`
                                text += `      queued: ${limiters[names[k]].queued}\n`
                                text += `      dropped: ${limiters[names[k]].dropped}\n`
                                text += `      completed: ${limiters[names[k]].completed}\n`
                                text += `      queued: ${limiters[names[k]].queued}\n`
                            }
                        }
                    }
                }
            }
        }
        process.stdout.write(text);
    }

    // Get the time when the function was called
    const appStartTime = new Date();
    
    // Start the loop
    // setTimeout(() => updateLog(appStartTime), delay);
    setInterval(() => {
        updateLog(appStartTime)
    }, delay);
}

export {logStats}