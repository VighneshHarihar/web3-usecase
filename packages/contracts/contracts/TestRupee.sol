// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Rupee-pegged TEST settlement unit (1 unit = ₹0.01). Dev/testnet only. See ADR-03.
contract TestRupee is ERC20, Ownable {
    constructor(address owner_) ERC20("Test Rupee", "tINR") Ownable(owner_) {}

    function decimals() public pure override returns (uint8) {
        return 2;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
