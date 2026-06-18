## expedition scene UI

+------------------------------------------------------------------+
|  [2] STAMINA UI                                                  |
|  +--------------------+   +---------------+   +-----------+     |
|  | [3]IMG  [4]======= |   |  [6] Depth: 7 |   | [9]  (O)  |     |
|  |  64x64  [5]90/100  |   +---------------+   |    [7]32  |     |
|  +--------------------+                       |    [8]3/5  |     |
|                                               +-----------+     |
|                                                                  |
|  +----------+                                    [11]           |
|  | [17.c]   |   item popup (FIFO queue)           (  )          |
|  +----------+                                   Give Up/        |
|  +----------+                                  Teleport         |
|  | [17.b]   |   item popup                                      |
|  +----------+                                                    |
|  +----------+    [1]                                            |
|  | [17.a]   |   item popup                   +-------------+   |
|  +----------+                                |  [10]       |   |
|                                              |  MINIMAP    |   |
|  +------+                  [13]  [12]        |             |   |
|  | [14] |  Inventory       ( )    ( )        +-------------+   |
|  |  (O) |  [15] 10/15     Pot.   Bomb                         |
|  +------+                                                       |
|    |                                                            |
|  [16] circular fill                                             |
+------------------------------------------------------------------+

LEGEND:
 1  Main game view          10  Minimap
 2  Stamina UI container    11  Give Up / Teleport (sprite)
 3  Player portrait 64×64  12  Bomb button
 4  Stamina bar             13  Potion button
 5  Stamina value 90/100   14  Inventory button (sprite)
 6  Depth text  e.g. 7     15  Inventory slots  e.g. 10/15
 7  Pickaxe sprite 32×32   16  Circular fill (inventory slots)
 8  Pickaxe uses left 3/5  17  Obtained items popups
 9  Circular fill (pickaxe)     .a → oldest  .b → next  .c → newest
                                (FIFO queue, max 3 stacks visible)
