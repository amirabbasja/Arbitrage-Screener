# A screener for finding arbitrage opportunities on DEXs or CEXs

## install.js

Having the necessary pairs, gets respective contract addresses of the each pair in DEXs and adds the info into a database. The database name should be "arbitrageDB" and the table for pairs is called "pairs".

## blockchainUtils.js

### Helper functions

Functions that help with general things that are needed inside classes in this file

### ethHandler

A class that is tasked with getting quotes in ethereum blockchain

### crawler

A class that is tasked with getting trading pair contract addresses for different chains and exchanges

## TODOs

1. Add router logic to controller directory and make router files logic-less.
