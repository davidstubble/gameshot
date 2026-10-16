CREATE TABLE `billingAccounts` (
	`userId` int NOT NULL,
	`appAccountToken` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billingAccounts_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `billingAccounts_appAccountToken_unique` UNIQUE(`appAccountToken`)
);
--> statement-breakpoint
CREATE TABLE `billingCatalog` (
	`key` varchar(100) NOT NULL,
	`environment` enum('test','live') NOT NULL,
	`stripeProductId` varchar(100) NOT NULL,
	`stripePriceId` varchar(100) NOT NULL,
	CONSTRAINT `billingCatalog_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `billingEvents` (
	`key` varchar(255) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billingEvents_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `billingLoginChallenges` (
	`nonceHash` varchar(64) NOT NULL,
	`redirectUri` varchar(2048) NOT NULL,
	`kind` enum('web','native') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	CONSTRAINT `billingLoginChallenges_nonceHash` PRIMARY KEY(`nonceHash`)
);
--> statement-breakpoint
CREATE TABLE `billingPurchases` (
	`key` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('stripe','apple') NOT NULL,
	`environment` enum('test','live') NOT NULL,
	`productKey` varchar(100) NOT NULL,
	`status` enum('pending','active','refunded','revoked','expired','failed') NOT NULL,
	`providerTransactionId` varchar(200) NOT NULL,
	`checkoutSessionId` varchar(200),
	`paymentIntentId` varchar(100),
	`customerId` varchar(100),
	`originalTransactionId` varchar(100),
	`amount` decimal(15,3),
	`currency` varchar(3),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingPurchases_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `billingAccounts` ADD CONSTRAINT `billingAccounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billingPurchases` ADD CONSTRAINT `billingPurchases_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;