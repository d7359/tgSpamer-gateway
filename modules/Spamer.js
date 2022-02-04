const moment = require('moment')
const async = require('async')
const request = require('request')
const API = require('./Api')
const TgAccounts = require('../controllers/TgAccountsController')
const TgContacts = require('../controllers/tgContactsController')
const sendTasksController = require('../controllers/sendTasksController')
const callbackTasksController = require('../controllers/callbackTasksController')
const config = require('../config.json')


class Spammer{

	constructor() {
		this.accounts = {

		}
	}

	async initSpammer(){
		await this.initAccounts()

		 this.checkSendTasks()
		 this.checkCallbackTasks()


	}

	parseContactsAll(req, callback){

		let contacts = []

		async.eachSeries(Object.keys(this.accounts), (phone, phoneCallback)=>{
				this.parseContacts(phone, req.body, result=>{
					console.log(result)

					if(contacts.length===0){
						contacts = result.contacts
					}

					return setTimeout(()=>{phoneCallback()}, 1000)
				})
			},
			err=>{
				if(err){
					console.error(err)
				}

				return request({
					url:'http://'+config.ip+':3024/save_contacts',
					method:'POST',
					headers:{'Content-Type':'application/json'},
					body:JSON.stringify({contacts, parsingId:req.body.parsingId, project:req.body.project})
				}, (error,  httpResponse, body)=>{
					console.error(error)
					// console.log(httpResponse)
					console.log(body)

					return callback({status:'ok'})
				})


			})
	}

	async parseContacts(phone, data, callback){

		let invite = false;
		let chat_users = []

		try {

		invite = await this.accounts[phone].call('messages.importChatInvite',{hash:data.hash})

		console.log('invite:',invite)
		}
		catch (e) {
			console.log(e)

			if(e.error_message && e.error_message ==='USER_ALREADY_PARTICIPANT'){
				const checkChatInvite = await this.accounts[phone].call('messages.checkChatInvite', {
					hash:data.hash,
					// limit:10
				})

				console.log(checkChatInvite);


				if(checkChatInvite.chat){
					const leaveChannel = await this.accounts[phone].call('channels.leaveChannel', {
						channel:{
							_:'inputChannel',
							channel_id:checkChatInvite.chat.id,
							access_hash: checkChatInvite.chat.access_hash
						}
					})

					return this.parseContacts(phone, data, callback)

				}
			}

			const search = await this.accounts[phone].call('contacts.search', {
				q:'@'+data.hash.replace('@',''),
				limit:10
			})

			console.log(search);

			if(search.chats.length===0){
				return callback({status:'error', msg:'Ничего не найдено'})
			}

			const joinChannel = await this.accounts[phone].call('channels.joinChannel', {
				channel: {
					_:'inputChannel',
					channel_id:search.chats[0].id,
					access_hash:search.chats[0].access_hash
				}
			})

			console.log('chat:', joinChannel)

			const users = {}

			const inputPeer = {
				// _: 'inputPeerChannel',
				_: 'inputPeerChannel',
				// channel_id: channel.id,
				channel_id: search.chats[0].id,
				access_hash: search.chats[0].access_hash
			};

			console.log(inputPeer)

			const LIMIT_COUNT = 1000
			let offset = 0;
			const allMessages = [];

			let history = await this.accounts[phone].call('messages.getHistory', {
				peer: inputPeer,
				add_offset: offset,
				limit: LIMIT_COUNT,
			});

			while(history.messages.length>0){

				allMessages.push(...history.messages);

				offset+=LIMIT_COUNT

				history = await this.accounts[phone].call('messages.getHistory', {
					peer: inputPeer,
					add_offset: offset,
					limit: LIMIT_COUNT,
				});


			}

			for(const message of allMessages){
				if(message._==='message'){
					// console.log(message)

					users[message.from_id.user_id] = {
						_:'inputUserFromMessage',
						peer: inputPeer,
						msg_id: message.id,
						user_id: message.from_id.user_id
					}
				}


				if(message._==='messageService' && message.action && message.action._==='messageActionChatAddUser'){
					// console.log(message)

					users[message.from_id.user_id] = {
						_:'inputUserFromMessage',
						peer: inputPeer,
						msg_id: message.id,
						user_id: message.from_id.user_id
					}
				}


				if(message._==='messageService' && message.action && message.action._==='messageActionChatJoinedByLink'){
					// console.log(message)

					users[message.from_id.user_id] = {
						_:'inputUserFromMessage',
						peer: inputPeer,
						msg_id: message.id,
						user_id: message.from_id.user_id
					}
				}
			}

			const getUsers = await this.accounts[phone].call('users.getUsers', {
				id:Object.values(users)
			})

			console.log(getUsers);

			chat_users = getUsers

			const leaveChannel = await this.accounts[phone].call('channels.leaveChannel', {
				channel:{
					_:'inputChannel',
					channel_id: search.chats[0].id,
					access_hash: search.chats[0].access_hash
				}
			})

		}

		let chat = false

		if(invite.chats && invite.chats[0]._==='chat') {
			chat = await this.accounts[phone].call('messages.getFullChat', {chat_id: invite.chats[0].id})

			console.log('chat:', chat)

			chat_users = chat.users
			const deleteChat = await this.accounts[phone].call('messages.deleteChatUser', {
				revoke_history: true,
				chat_id:invite.chats[0].id,
				user_id: {
					_:'inputUserSelf'
				}
			})
		}

		if(invite.chats  && invite.chats[0]._==='channel') {
			const users = {}

			const inputPeer = {
				// _: 'inputPeerChannel',
				_: 'inputPeerChannel',
				// channel_id: channel.id,
				channel_id: invite.chats[0].id,
				access_hash: invite.chats[0].access_hash
			};

			console.log(inputPeer)

			const LIMIT_COUNT = 1000
			let offset = 0;
			const allMessages = [];

			let history = await this.accounts[phone].call('messages.getHistory', {
				peer: inputPeer,
				add_offset: offset,
				limit: LIMIT_COUNT,
			});

			// console.log(firstHistoryResult)

			// const historyCount = firstHistoryResult.count;
			// const historyCount = firstHistoryResult.messages.length;


			// for (let offset = 0; offset < historyCount; offset += LIMIT_COUNT) {
			while(history.messages.length>0){

				allMessages.push(...history.messages);

				offset+=LIMIT_COUNT

				history = await this.accounts[phone].call('messages.getHistory', {
					peer: inputPeer,
					add_offset: offset,
					limit: LIMIT_COUNT,
				});


			}


			for(const message of allMessages){
				if(message._==='message'){
					// console.log(message)

					users[message.from_id.user_id] = {
						_:'inputUserFromMessage',
						peer: inputPeer,
						msg_id: message.id,
						user_id: message.from_id.user_id
					}
				}


				if(message._==='messageService' && message.action && message.action._==='messageActionChatAddUser'){
					// console.log(message)

					users[message.from_id.user_id] = {
						_:'inputUserFromMessage',
						peer: inputPeer,
						msg_id: message.id,
						user_id: message.from_id.user_id
					}
				}


				if(message._==='messageService' && message.action && message.action._==='messageActionChatJoinedByLink'){
					// console.log(message)

					users[message.from_id.user_id] = {
						_:'inputUserFromMessage',
						peer: inputPeer,
						msg_id: message.id,
						user_id: message.from_id.user_id
					}
				}
			}

			const getUsers = await this.accounts[phone].call('users.getUsers', {
				id:Object.values(users)
			})

			console.log(getUsers);

			chat_users = getUsers;

			const leaveChannel = await this.accounts[phone].call('channels.leaveChannel', {
				channel:{
					_:'inputChannel',
					channel_id: invite.chats[0].id,
					access_hash: invite.chats[0].access_hash
				}
			})
		}


		// const deleteChat = await this.accounts[phone].call('messages.deleteChatUser', {
		// 	revoke_history: true,
		// 	chat_id:invite.chats[0].id,
		// 	user_id: {
		// 		_:'inputUserSelf'
		// 	}
		// })


		const contactIds = chat_users.map(el=>el.id)

		const contacts = []

		return TgContacts.getAllByCondition({id:{$in:contactIds}, tg_account:phone}, result=>{

			console.log(result)

			const oldContacts = result.map(el=>el.id)

			for(const user of chat_users){

				if(oldContacts.includes(user.id)){
					continue;
				}

				contacts.push({
					id:user.id,
					access_hash:user.access_hash,
					first_name:user.first_name || '',
					last_name:user.last_name || '',
					username:user.username || '',
					phone:user.phone || '',
					tg_account:phone
				})


			}

			return TgContacts.createMany(contacts, result=>{


				console.log(result)

				return callback({status: 'ok', contacts})
			})

		})

	}

	async getAccounts(){
		 return await TgAccounts.getAllByCondition({status:'active'});
	}

	async initAccounts(){

		return new Promise(async resolve=>{
			const accounts = await this.getAccounts()

			if(accounts.error){

				console.error(accounts);

				return resolve()
			}

			for(const account of accounts){


				await this.initAccount(account)

			}

			return resolve()
		})

	}

	 initAccount(account){

		console.log('initAccount')

		return new Promise(async resolve => {

			if(this.accounts[account.phone]){
				return resolve();
			}

			if(!this.accounts[account.phone]) {

				this.accounts[account.phone] = new API(account)
			}

			const user = await this.getUser(account.phone);

			if(!user){
				return resolve();
			}

			this.accounts[account.phone].mtproto.updates.on('updatesTooLong', (updateInfo) => {
				console.log('updatesTooLong:', updateInfo);
			});

			this.accounts[account.phone].mtproto.updates.on('updateShortMessage', async (updateInfo) => {
				console.log('updateShortMessage:', updateInfo);

				await callbackTasksController.create({execute_time:moment().format('YYYY-MM-DD HH:mm:ss'), data: {phone:account.phone, user:{id:updateInfo.user_id},incomingMessage:true}})
			});

			this.accounts[account.phone].mtproto.updates.on('updateShortChatMessage', async (updateInfo) => {
				console.log('updateShortChatMessage:', updateInfo);


			});

			this.accounts[account.phone].mtproto.updates.on('updateShort', (updateInfo) => {
				console.log('updateShort:', updateInfo);
			});

			this.accounts[account.phone].mtproto.updates.on('updatesCombined', (updateInfo) => {
				console.log('updatesCombined:', updateInfo);
			});

			this.accounts[account.phone].mtproto.updates.on('updates', async (updateInfo) => {
				console.log('updates:', updateInfo);
			});

			this.accounts[account.phone].mtproto.updates.on('updateShortSentMessage', (updateInfo) => {
				console.log('updateShortSentMessage:', updateInfo);
			});

			return resolve();
		})

	}

	async createAccount(req, res){
		const accounts = await TgAccounts.getAllByCondition({phone:req.body.phone})

		if(accounts.error){
			console.error(accounts)
			return res.json({status:'error', msg:'Ошибка при проверке аккаунта'})
		}

		if(accounts.length>0){
			return res.json({status:'error', msg:'Уже есть такой аккаунт'})
		}

		console.log(accounts)

		let result = await TgAccounts.create({phone: req.body.phone, api_id: req.body.api_id, api_hash:req.body.api_hash, status:'draft'})

		console.log(result)

		if(result.error){
			console.error(result)
			return res.json({status:'error', msg:'Ошибка при проверке аккаунта'})
		}

		await this.initAccount(req.body)

		const { phone_code_hash } = await this.sendCode(req.body.phone);

		result = await TgAccounts.update({phone: req.body.phone}, {phone_code_hash})

		if(result.error){
			console.error(result)
			return res.json({status:'error', msg:'Ошибка при проверке аккаунта'})
		}

		return res.json({status:'ok'})


	}

	async createSendTask(req, res){

		let result = await sendTasksController.create({...req.body, execute_time: moment(req.body.execute_time).subtract(6,'hours').format('YYYY-MM-DD HH:mm:ss')})

		if(result.error){
			console.error(result)
			return res.json({status:'error', msg:'Ошибка при создании'})
		}

		return res.json({status:'ok'})

	}


	async confirmCode(req, res){

		const accounts = await TgAccounts.getAllByCondition({phone:req.body.phone})

		if(accounts.error){
			console.error(accounts)
			return res.json({status:'error', msg:'Ошибка при проверке аккаунта'})
		}

		if(accounts.length===0){
			return res.json({status:'error', msg:'Нет такого аккаунта'})
		}

		const account = accounts[0]

		account.code = req.body.code

		try {
			const signInResult = await this.signIn({
				code: account.code,
				phone: account.phone,
				phone_code_hash: account.phone_code_hash,
			});

			if (signInResult._ === 'auth.authorizationSignUpRequired') {
				await this.signUp({
					phone: account.phone,
					phone_code_hash: account.phone_code_hash,
				});
			}



			let result = await TgAccounts.update({phone:req.body.phone}, {status:'active'})

			if(result.error){
				console.error(result)
				return res.json({status:'error', msg:'Ошибка при активации аккаунта'})
			}

			await this.initAccount(account)

			return res.json({status:'ok'})


		} catch (error) {
			console.error(error)

			return res.json({status:'error', msg:'Ошибка авторизации'})
		}

	}

	async getUser(phone) {
		try {
			const user = await this.accounts[phone].call('users.getFullUser', {
				id: {
					_: 'inputUserSelf',
				},
			});

			return user;
		} catch (error) {
			return null;
		}
	}

	sendCode(phone) {
		return this.accounts[phone].call('auth.sendCode', {
			phone_number: phone,
			settings: {
				_: 'codeSettings',
			},
		});
	}

	signIn({ code, phone, phone_code_hash }) {
		return this.accounts[phone].call('auth.signIn', {
			phone_code: code,
			phone_number: phone,
			phone_code_hash: phone_code_hash,
		});
	}

	signUp({ phone, phone_code_hash }) {
		return this.accounts[phone].call('auth.signUp', {
			phone_number: phone,
			phone_code_hash: phone_code_hash,
			first_name: 'MTProto',
			last_name: 'Core',
		});
	}

	getPassword(phone) {
		return this.accounts[phone].call('account.getPassword');
	}

	checkPassword(phone, { srp_id, A, M1 }) {
		return this.accounts[phone].call('auth.checkPassword', {
			password: {
				_: 'inputCheckPasswordSRP',
				srp_id,
				A,
				M1,
			},
		});
	}

	async checkSendTasks(){

		const tasks = await sendTasksController.getAllByCondition({status: null, execute_time: {$lte: moment().format('YYYY-MM-DD HH:mm:ss')}})
		console.log(tasks)
		if(tasks.error){
			return setTimeout(()=>{this.checkSendTasks()}, 3000)
		}

		if(tasks.length===0){
			return setTimeout(()=>{this.checkSendTasks()}, 3000)
		}

		await this.executeSendTasks(tasks)

		this.checkSendTasks()

	}

	async checkCallbackTasks(){

		const tasks = await callbackTasksController.getAllByCondition({status: null, execute_time: {$lte: moment().format('YYYY-MM-DD HH:mm:ss')}})

		console.log(tasks)

		if(tasks.error){
			return setTimeout(()=>{this.checkCallbackTasks()}, 3000)
		}

		if(tasks.length===0){
			return setTimeout(()=>{this.checkCallbackTasks()}, 3000)
		}

		await this.executeCallbackTasks(tasks)

		this.checkCallbackTasks()

	}

	executeSendTasks(tasks){
		return new Promise(async resolve=>{

			const success_ids = []
			const failure_ids = []
			const callbackTasks = []


			return async.eachSeries(tasks, (task, taskCallback)=>{
					(async ()=>{

						const contacts = await TgContacts.getAllByCondition({id:task.data.user.id})

						console.log(contacts)

						task.data.user.access_hash = contacts[0].access_hash

						let d = await this.sendMessage(task.data)

						const callbackTask = {
							data:task.data,
							execute_time: moment().format('YYYY-MM-DD HH:mm:ss')
						}
						callbackTask.data.type = 'status'

						if(d.status==='ok'){
							callbackTask.sent = true
							success_ids.push(task._id.toString())
						}
						else{
							callbackTask.sent = false
							failure_ids.push(task._id.toString())
						}

						callbackTasks.push(callbackTask)

						return setTimeout(()=>{taskCallback()})
					})();
				},
				err=>{
					if(err){
						console.error(err)
					}

					sendTasksController.updateMany({_id:{$in:success_ids}}, {status:'ok'}, result=>{
						console.log(result)
					})
					sendTasksController.updateMany({_id:{$in:failure_ids}}, {status:'error'}, result=>{
						console.log(result)
					})

					callbackTasksController.createMany(callbackTasks, result=>{
						console.log(result)
					})


					return resolve()
				}
			)

		})
	}

	executeCallbackTasks(tasks){
		return new Promise(resolve=>{

			const success_ids = []
			const failure_ids = []

			return async.eachSeries(tasks, (task, taskCallback)=>{
					(async ()=>{
						let d = await this.sendRequest(task.data)

						if(d.status==='ok'){
							// callbackTask.sent = true
							success_ids.push(task._id.toString())
						}
						else{

							failure_ids.push(task._id.toString())
						}


						return setTimeout(()=>{taskCallback()})
					})();
				},
				err=>{
					if(err){
						console.error(err)
					}

					callbackTasksController.updateMany({_id:{$in:success_ids}}, {status:'ok'}, result=>{
						console.log(result)
					})
					callbackTasksController.updateMany({_id:{$in:failure_ids}}, {status:'error'}, result=>{
						console.log(result)
					})


					return resolve()
				}
			)

		})
	}

	async sendMessage(data){

		console.log(data)

		return new Promise(async resolve=>{
			const addContact = await this.accounts[data.phone].call('contacts.addContact', {
				id	:{
					_: 'inputPeerUser',
					user_id: data.user.id,
					access_hash: data.user.access_hash
				},
				first_name:	data.user.first_name || '',
				last_name:	data.user.last_name || '',
				phone:	data.user.phone ||''
			})

			console.log({
				id	:{_: 'inputUser',
					user_id: data.user.id,
					access_hash: data.user.access_hash
				},
				first_name:	data.user.first_name || '',
				last_name:	data.user.last_name || '',
				phone:	data.user.phone ||''
		})
			console.log('addContactasd: ', addContact)


			const sendMessage = await this.accounts[data.phone].call('messages.sendMessage', {
				peer	:{
					_: 'inputPeerUser',
					user_id: data.user.id,
					access_hash: data.user.access_hash
				},
				message:	data.message,
				random_id:	Math.ceil(Math.random() * 0xffffff) + Math.ceil(Math.random() * 0xffffff),
			})

			console.log('sendMessageasd: ', addContact)

			if(sendMessage._!=='updateShortSentMessage'){

				console.error(sendMessage)

				return resolve({status:'error'})
			}

			return resolve({status:'ok'})

		})
	}

	sendRequest(data){
		return new Promise(resolve => {
			return request({
				url:'http://'+config.ip+':3024/mailing_callbacks',
				method:'POST',
				headers:{'Content-Type':'application/json'},
				body:JSON.stringify(data)
			}, (error,  httpResponse, body)=>{
				console.error(error)
				// console.log(httpResponse)
				console.log(body)

				if(error){
					return resolve({status:'error'})
				}

				return resolve({status:'ok'})
			})
		})
	}

}

const SpammerCls = new Spammer()

module.exports = SpammerCls