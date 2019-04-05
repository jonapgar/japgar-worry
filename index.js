const {
	inspect=false
} = require('sixargs')
const pidusage = require('pidusage')


const lastValue = arr=>arr.length ? arr[arr.length-1]:undefined
const sum = arr=>arr.reduce((a,v)=>a+v,0)

let start = Date.now()
let memoryInterval
const worry = (config,status={},options={},reset={})=>{

	clearInterval(memoryInterval)
	let {
	 maxLag = 30000,
	 memoryThreshold = 0.90,
	 graylogRate = 60000, //every minute
	 memoryPoll = 5000, //check mem every five seconds
	 maxWarningTime = 60 * 1000 //bad after one min of warnings
	} = config

	let maxMemory = Math.ceil(process.env.SERVER_MEM * 1000 * 1000 * memoryThreshold)
	let every = graylogRate / memoryPoll
	let maxWarnings = maxWarningTime / memoryPoll
	let e = every
	let lagAccumulation = 0
	let last = Date.now()
	let grace = 0.1 * memoryPoll //magic number
	memoryInterval = setInterval(()=>{
		pidusage(process.pid,(err,stats)=>{
			next(stats)
		})
	},memoryPoll)
	let messages=[]
	let memoryWarning=0
	
	

	next =({memory,cpu})=>{
		let now = Date.now()
		let lag = now-last-memoryPoll
		last = now
		if (lag <= grace)
			lagAccumulation=0
		else
			lagAccumulation+=lag


		if (memory > maxMemory) {
			zzz.error('mem is HIGH %d > %d',memory,maxMemory)
			memoryWarning++
		} else {
			if (memoryWarning > 0)
				memoryWarning--
			zzz.verbose('mem is good %d < %d',memory,maxMemory)
			memoryWarning = 0
		}

		

		let message = {...status,cpu,memory, elapsed:Math.round((now-start)/1000),lagAccumulation,memoryWarning}
		
		zzz.verbose('STATUS: %o', {pid:process.pid,clusterIndex:global.clusterIndex,...message})

		e--
		let avg =arr=>arr.length ? sum(arr)/arr.length:0

		if (e <= 0) {
			let map = {

				cpu:avg,
				memory:arr=>Math.round(avg(arr)),
				
				lagAccumulation:lastValue,
				memoryWarning:sum,
				elapsed:lastValue,
				...options
			}	
			//every minute
			e = every
			let average = Object.keys(message).reduce((a,k)=>{
				a[k]=[]
				return a
			},{})
			for (let message of messages) {
				for (let k in message) {
					average[k].push(message[k])
				}	
			}
			let m = 1/(messages.length+1)
			for (let k in average) {
				average[k]=(map[k] || lastValue)(average[k])
			}
			zzz.log('STATUS AVG: %o',average)
			graylog('status', average)
			messages=[]
		} else {
			messages.push(message)
		}
		
			
		
		if (memoryWarning > maxWarnings) {
			clearInterval(memoryInterval)
			zzz.error('BEEN AT MEMORY LIMIT TOO LONG, DYING')
			process.kill(process.pid, 'SIGINT')
		}	
		if (lagAccumulation > maxLag && !inspect) {
			clearInterval(memoryInterval)
			zzz.error('BEEN LAGGING TOO LONG, DYING')
			process.kill(process.pid, 'SIGINT')
		}

		for (var k in message) {
			status[k] = message[k]
		}
		for (var k in reset) {
			status[k] = reset[k]
		}
	}
	for (var k in reset) {
		status[k] = reset[k]
	}
	return status	
}


module.exports = worry
