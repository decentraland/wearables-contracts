
# Collections' architecture

## Contracts

<!--
```dot
digraph {
    rankdir=TB
    graph [fontname = "arial", fontsize="10", color="grey", fontcolor="grey"]
    node [fontname = "arial",fontsize="10", shape="box", style="rounded"]
    edge [fontname = "arial",color="blue", fontcolor="black",fontsize="10"]

    DAO_L2_Bridge -&gt; Forwarder[style=dashed, color=green, fontcolor=green, label="Owner of;\nSet which contract can call it;"]
    DAO_L2_Bridge -&gt; Collection_Manager[style=dashed,color=green, fontcolor=green, label="Owner of;\n Set protocol parameters:\nCommittee address;\nPrice per item;"]
    DAO_L2_Bridge -&gt; Committee[style=dashed,color=green, fontcolor=green, label="Owner of;\n Add/Remove members;"]
    DAO_L2_Bridge -&gt; Rarities[style=dashed,color=green, fontcolor=green, label="Owner of;\n Add/Update rarities;"]

    Forwarder -&gt; Collection_Factory[style=dashed,color=green, fontcolor=green, label="Owner of;\n The only address allowed to create\n collections"]
    
    Forwarder -&gt; collection[style=dashed,color=green, fontcolor=green, label="Owner of;\n Approve/Reject;\nRescue items;"]
    
    node [fontname = "arial",fontsize="10", shape="plaintext", style="rounded", fontsize=12]
    Commitee_Member -&gt; Committee[color=blue, fontcolor=blue, label="   Manage collections:\nApprove/Reject;\nRescue items;"]
    
    User -&gt; Collection_Manager[shape=plaintext, color=orange, fontcolor=orange,  label="Create collection\n by paying Matic MANA"]
    node [fontname = "arial",fontsize="10", shape="box", style="rounded"]

    Collection_Manager -&gt; Forwarder[color=orange, fontcolor=orange,  label=""] 
    Forwarder -&gt; Collection_Factory[color=orange, fontcolor=orange,  label=""]

    Collection_Factory -&gt; collection[color=orange, fontcolor=orange]

    Committee -&gt; Collection_Manager[color=blue, fontcolor=blue,  label=""]
    Collection_Manager -&gt; Forwarder[color=blue, fontcolor=blue,  label=""]
    
    Forwarder -&gt; Collection[color=blue, fontcolor=blue,  label=""]

    Collection_Manager -&gt; Rarities[style=dashed, color=pink, fontcolor=pink,  label="   Get rarity info.\n   E.g: price to deploy"]
    collection -&gt; Rarities[style=dashed, color=pink, fontcolor=pink,  label="   Get rarity info.\n E.g: max supply"]


    edge[ style = invis ]

    { DAO_L2_Bridge Collection_Manager } -&gt; { Forwarder Rarities }
    {Forwarder} -&gt; { Collection_Factory collection }
}
```
-->
![images/collections-architecture/fig-contracts.svg](images/collections-architecture/fig-contracts.svg)

- **DAO_L2_Bridge**: Contract which receives messages from the DAO in L1. It sets the protocol parameters for every smart contract living in L2.

- **Committee**: Tolecollections' committee. The DAO will add/remove members, and members can manage collections through it.

- **Collection_Manager**: The collections' manager contract. This contract is responsible for creating collections and also allowing the Committee to manage them.

Every user will be able to deploy collections by paying X MANA. The amount of MANA to pay will be set by the DAO.

- **Forwarder**: The forwarder is a contract which forwards calls to target contracts. The forwarder is the owner of the ollection factory and each collection. You can see it just as a tube_

Every user will be able to deploy collections by paying X MANA. The amount of MANA to pay will be set by the DAO.

- **Rarities**: Contract with all the rarities info: name, max supply, and price to deploy. Rarities can only be added, and **only** the price can be updated. The only entity allowed to do this is the the DAO
