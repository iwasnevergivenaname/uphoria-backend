require("dotenv").config()
const db = require("../models")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const APP_SECRET = process.env.APP_SECRET

const resolver = {
	Query: {
		user: {
			description: "Returns a user based off their ID",
			resolve: async (_, {id, ...args}, context) => {
				if(!args.privilegedSecret) { args.privilegedSecret = "" }
				const foundUser = await db.User.findById(id)
				if(args.privilegedSecret !== "antiTikTok") {
					foundUser.email = "Not Authorized"
					foundUser.birthday = "Not Authorized"
				}
				return foundUser
			}
		},
		users: {
			description: "Returns all users",
			resolve: async () => {
				if(!args.privilegedSecret) { args.privilegedSecret = "" }
				const foundUsers = await db.User.find()
				if(args.privilegedSecret !== "antiTikTok") {
					for(let i = 0; i < foundUsers.length; i++) {
						foundUsers[i].email = "Not Authorized"
						foundUsers[i].birthday = "Not Authorized"
					}
				}
				return foundUsers
			}
		},
		video: {
			description: "Returns a video based off the ID",
			resolve: async (_, {id}, context) => {
				return await db.Video.findById(id)
			}
		},
		videos: {
			description: "Returns all videos",
			resolve: async (_, args, context) => {
				return await db.Video.find()
			}
		}
	},
	Mutation: {
		signup: {
			description: "Create a new user",
			resolve: async (_, args, context) => {
				args.password = await bcrypt.hash(args.password, 10)
				const newUser = await db.User.create({...args})
				const user = newUser

				const token = jwt.sign({userId: user._id}, APP_SECRET)

				return {
					token,
					user,
				}
			}
		},
		login: {
			description: "Login and authenticate",
			resolve: async (_, args, context) => {
				const loginUser = await db.User.findOne({email: args.email})
				if (!loginUser) {
					throw new Error("No such user found")
				}

				const valid = await bcrypt.compare(args.password, loginUser.password)
				if (!valid) {
					throw new Error("Invalid password")
				}

				const user = loginUser.toObject()

				console.log(user)

				return {
					token: jwt.sign(user, APP_SECRET),
					user,
				}
			}
		},
		updateUser: {
			description: "Update a user",
			resolve: async (_, args, context) => {
				if (!context.user) throw new Error("Protected Route, please login")
				if (context.user.id !== args.id) throw new Error("You are not authorized to update another user")
				const {id, ...setArgs} = args
				return await db.User.findByIdAndUpdate({_id: id}, {$set: {...setArgs}}, {"new": true})
			}
		},
		deleteUser: {
			description: "We aren't Tik Tok",
			resolve: async (_, {id}, context) => {
				if (!context.user) throw new Error("Protected Route, please login")
				if (context.user.id !== args.id) throw new Error("You are not authorized to delete another user")
				await new Promise((resolve, reject) => {
					db.User.findByIdAndDelete(id, (err, docs) => {
						if (err) reject(err)
						else resolve(true)
					})
				})
				return new Promise((resolve, reject) => {
					db.Video.deleteMany({userId: id}, (err, docs) => {
						if (err) reject(err)
						else resolve(true)
					})
				})
			}
		},
		createVideo: {
			description: "Create a uphoria video",
			resolve: async (_, {description, userId, videoUrl}, context) => {
				if (!context.user) throw new Error("Protected Route, please login")
				return await db.Video.create({description, userId, videoUrl})
			}
		},
		updateVideo: {
			description: "Update a uphoria video",
			resolve: async (_, {id, likeId, share, ...setArgs}, context) => {
				if (!context.user) throw new Error("Protected Route, please login")
				let updateField = {$set: {...setArgs}}
				if (likeId) {
					updateField.$push = {likes: likeId}
				}
				if (share) {
					updateField.$inc = {shares: share}
				}
				return await db.Video.findByIdAndUpdate({_id: id}, {...updateField}, {"new": true})
			}
		},
		deleteVideo: {
			description: "Delete your trash video",
			resolve: async (_, {id}, context) => {
				if (!context.user) throw new Error("Protected Route, please login")
				return new Promise((resolve, reject) => {
					const deletedUser = db.Video.findByIdAndDelete(id, (err, docs) => {
						if (err) reject(err)
						else resolve(true)
					})
				})
			}
		},
		deleteVideos: {
			description: "TikTok Found Us",
			resolve: async (_, args, context) => {
				if (!context.user) throw new Error("Protected Route, please login")
				if (context.user.permissionLevel === 1) throw new Error("You are not authorized to hide us from Tik Tok")
				return new Promise((resolve, reject) => {
					db.Video.remove({}, (err, docs) => {
						if (err) reject(err)
						else resolve(true)
					})
				})
			}
		}
	}
}

module.exports = resolver