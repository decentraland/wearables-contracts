<pre>
  Title: Collections v2 approval flow
  Author: Ignacio Mazzara <nacho@decentraland.org>
  Type: informational
  Created: 2020-08-28
</pre>

# Collection V2 contract

## Table of Contents

- [Introduction](#introduction)
- [Solution](#solution)

## Introduction

Every item as wearable, emotes, 3d object, etc in Decentraland's world is represented by a non-fungible token ERC #721 that is indivisible and unique. Those items together defines a collection which works as a registry powered by a smart contract where it is defined all the information. A collection can be built by anyone but approved by a governance system (committee).

## Solution

A way to moderate the content of the Decentraland collections is needed to prevent spam, abuse, clone and copyright. The Decentraland's collections will be created in a L2 governed any kind of governance in L1. E.g: DAO. The collection deployment will has a cost in MANA based on the items amount and its rarities. Also, each collection will be created as rejected awaiting for the approval of the members of the committee.
